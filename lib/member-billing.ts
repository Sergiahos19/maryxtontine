import { randomUUID } from "node:crypto";

import { recordAdminActivity } from "@/lib/admin-activity";
import { db, getDailyContribution, getDailyLatePenalty, lock, transaction, utcStamp, type Db } from "@/lib/database";
import { currentDate, nextDate } from "@/lib/dates";

export type BillingSummary = {
  outstandingDebt: number;
  unpaidDays: number;
  penaltyDebt: number;
};

export type PaymentAllocation = BillingSummary & {
  appliedToDebt: number;
  appliedToContributions: number;
};

type MemberBillingRow = {
  id: string;
  billing_start_date: string | null;
  last_billing_check_date: string | null;
  last_due_date: string | null;
};

async function readSummary(tx: Db, memberId: string, billingDate: string) {
  const row = await tx.get<BillingSummary>(`
    select coalesce((select sum(contribution_amount - contribution_paid) from member_dues where member_id = ? and due_date < ?), 0)
             + coalesce((select sum(amount - paid_amount) from member_penalties where member_id = ?), 0) as "outstandingDebt",
           coalesce((select sum(case when contribution_paid < contribution_amount then quantity else 0 end) from member_dues where member_id = ? and due_date < ?), 0) as "unpaidDays",
           coalesce((select sum(amount - paid_amount) from member_penalties where member_id = ?), 0) as "penaltyDebt"
  `, [memberId, billingDate, memberId, memberId, billingDate, memberId]);
  return row ?? { outstandingDebt: 0, unpaidDays: 0, penaltyDebt: 0 };
}

async function storeSummary(tx: Db, memberId: string, summary: BillingSummary) {
  await tx.run("update members set outstanding_debt = ?, unpaid_days = ?, billing_migrated = 1 where id = ?", [summary.outstandingDebt, summary.unpaidDays, memberId]);
}

/** Génère les échéances et pénalités d’un membre jusqu’à `billingDate` (à appeler sous verrou). */
async function syncOneMember(tx: Db, memberId: string, billingDate: string, contribution: number, penaltyRate: number) {
  const member = await tx.get<MemberBillingRow>(
    "select id, billing_start_date, last_billing_check_date, last_due_date from members where id = ? and role = 'MEMBER' and status = 'ACTIVE'",
    [memberId],
  );
  if (!member) return null;

  const startDate = member.billing_start_date && member.billing_start_date <= billingDate ? member.billing_start_date : billingDate;
  let dueDate = member.last_due_date && member.last_due_date >= startDate ? nextDate(member.last_due_date) : startDate;
  let lastDueDate = member.last_due_date;
  while (dueDate < billingDate) {
    await tx.run(
      "insert into member_dues (id, member_id, due_date, contribution_amount, quantity) values (?, ?, ?, ?, 1) on conflict (member_id, due_date) do nothing",
      [randomUUID(), member.id, dueDate, contribution],
    );
    lastDueDate = dueDate;
    dueDate = nextDate(dueDate);
  }
  if (lastDueDate && lastDueDate !== member.last_due_date) {
    await tx.run("update members set last_due_date = ? where id = ?", [lastDueDate, member.id]);
  }

  let penaltyDate = member.last_billing_check_date ? nextDate(member.last_billing_check_date) : nextDate(startDate);
  let newlyAddedPenalty = 0;
  let newlyOverdueDays = 0;
  while (penaltyDate <= billingDate) {
    const overdue = await tx.get("select 1 from member_dues where member_id = ? and due_date < ? and contribution_paid < contribution_amount limit 1", [member.id, penaltyDate]);
    if (overdue) {
      const inserted = await tx.run(
        "insert into member_penalties (id, member_id, penalty_date, amount) values (?, ?, ?, ?) on conflict (member_id, penalty_date) do nothing",
        [randomUUID(), member.id, penaltyDate, penaltyRate],
      );
      if (inserted) {
        newlyAddedPenalty += penaltyRate;
        newlyOverdueDays += 1;
      }
    }
    penaltyDate = nextDate(penaltyDate);
  }
  await tx.run("update members set last_billing_check_date = ? where id = ?", [billingDate, member.id]);

  const summary = await readSummary(tx, member.id, billingDate);
  await storeSummary(tx, member.id, summary);

  if (newlyOverdueDays > 0) {
    const totalPenalty = summary.penaltyDebt.toLocaleString("fr-FR");
    const totalDebt = summary.outstandingDebt.toLocaleString("fr-FR");
    await tx.run(
      "insert into notifications (id, member_id, title, message, severity, event_key) values (?, ?, 'Retard de cotisation', ?, 'warning', ?) on conflict do nothing",
      [
        randomUUID(),
        member.id,
        `${newlyOverdueDays} jour(s) de retard supplémentaire(s). ${newlyAddedPenalty.toLocaleString("fr-FR")} FCFA de pénalité ajoutés. Pénalités dues : ${totalPenalty} FCFA. Total à régler : ${totalDebt} FCFA.`,
        `late-fee:${member.id}:${billingDate}`,
      ],
    );
    await recordAdminActivity(member.id, "Retard de cotisation", `${newlyOverdueDays} jour(s) supplémentaire(s); ${newlyAddedPenalty.toLocaleString("fr-FR")} FCFA ajoutés. Dette totale : ${totalDebt} FCFA.`, tx);
  }
  return summary;
}

/** Met à jour un membre, ou tous les membres actifs si aucun identifiant n’est fourni. */
export async function syncMemberBilling(memberId?: string, billingDate = currentDate(), parent?: Db) {
  const contribution = await getDailyContribution(parent ?? db);
  const penaltyRate = await getDailyLatePenalty(parent ?? db);
  const ids = memberId
    ? [memberId]
    : (await (parent ?? db).all<{ id: string }>("select id from members where role = 'MEMBER' and status = 'ACTIVE'")).map((row) => row.id);

  const summaries = new Map<string, BillingSummary>();
  for (const id of ids) {
    const summary = await transaction(async (tx) => {
      await lock(tx, `member:${id}`);
      return syncOneMember(tx, id, billingDate, contribution, penaltyRate);
    }, parent);
    if (summary) summaries.set(id, summary);
  }
  return summaries;
}

export async function getMemberBillingSummary(memberId: string, billingDate = currentDate(), parent?: Db) {
  const summaries = await syncMemberBilling(memberId, billingDate, parent);
  return summaries.get(memberId) ?? readSummary(parent ?? db, memberId, billingDate);
}

/**
 * Affecte un paiement dans l’ordre : pénalités, échéances impayées les plus anciennes,
 * puis jours suivants à partir du lendemain du dernier jour déjà couvert.
 * Aucun montant ne reste non affecté : le surplus couvre toujours des jours à venir.
 */
export async function applyMemberPayment(
  memberId: string,
  amount: number,
  billingDate = currentDate(),
  contributionAmount?: number,
  parent?: Db,
): Promise<PaymentAllocation> {
  if (!Number.isSafeInteger(amount) || amount < 1) throw new Error("INVALID_PAYMENT_AMOUNT");

  return transaction(async (tx) => {
    const dailyAmount = contributionAmount ?? await getDailyContribution(tx);
    if (!Number.isSafeInteger(dailyAmount) || dailyAmount < 1) throw new Error("INVALID_CONTRIBUTION_AMOUNT");
    await lock(tx, `member:${memberId}`);
    await syncOneMember(tx, memberId, billingDate, await getDailyContribution(tx), await getDailyLatePenalty(tx));

    let remaining = amount;
    let appliedToDebt = 0;
    let appliedToContributions = 0;

    const penalties = await tx.all<{ id: string; amount: number; paidAmount: number }>(
      `select id, amount, paid_amount as "paidAmount" from member_penalties where member_id = ? and paid_amount < amount order by penalty_date`,
      [memberId],
    );
    for (const penalty of penalties) {
      if (remaining <= 0) break;
      const paid = Math.min(remaining, penalty.amount - penalty.paidAmount);
      await tx.run("update member_penalties set paid_amount = ? where id = ?", [penalty.paidAmount + paid, penalty.id]);
      remaining -= paid;
      appliedToDebt += paid;
    }

    const dues = await tx.all<{ id: string; dueDate: string; contributionAmount: number; contributionPaid: number }>(`
      select id, due_date as "dueDate", contribution_amount as "contributionAmount", contribution_paid as "contributionPaid"
      from member_dues where member_id = ? and contribution_paid < contribution_amount order by due_date
    `, [memberId]);
    for (const due of dues) {
      if (remaining <= 0) break;
      const paid = Math.min(remaining, due.contributionAmount - due.contributionPaid);
      await tx.run("update member_dues set contribution_paid = ?, updated_at = ? where id = ?", [due.contributionPaid + paid, utcStamp(), due.id]);
      remaining -= paid;
      if (due.dueDate < billingDate) appliedToDebt += paid;
      else appliedToContributions += paid;
    }

    if (remaining > 0) {
      const member = await tx.get<{ lastDueDate: string | null }>(`select last_due_date as "lastDueDate" from members where id = ?`, [memberId]);
      let dueDate = member?.lastDueDate && member.lastDueDate >= billingDate ? nextDate(member.lastDueDate) : billingDate;
      let lastCoveredDate = member?.lastDueDate ?? null;
      while (remaining > 0) {
        const exists = await tx.get("select 1 from member_dues where member_id = ? and due_date = ?", [memberId, dueDate]);
        if (!exists) {
          const paid = Math.min(remaining, dailyAmount);
          await tx.run(
            "insert into member_dues (id, member_id, due_date, contribution_amount, quantity, contribution_paid) values (?, ?, ?, ?, 1, ?)",
            [randomUUID(), memberId, dueDate, dailyAmount, paid],
          );
          remaining -= paid;
          appliedToContributions += paid;
          lastCoveredDate = dueDate;
        }
        dueDate = nextDate(dueDate);
      }
      await tx.run(
        "update members set last_due_date = case when last_due_date is null or last_due_date < ? then ? else last_due_date end where id = ?",
        [lastCoveredDate, lastCoveredDate, memberId],
      );
    }

    const summary = await readSummary(tx, memberId, billingDate);
    await storeSummary(tx, memberId, summary);
    return { ...summary, appliedToDebt, appliedToContributions };
  }, parent);
}
