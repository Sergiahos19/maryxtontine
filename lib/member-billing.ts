import { randomUUID } from "node:crypto";

import { recordAdminActivity } from "@/lib/admin-activity";
import { database, getDailyContribution, getDailyLatePenalty } from "@/lib/database";

export type BillingSummary = {
  outstandingDebt: number;
  unpaidDays: number;
  penaltyDebt: number;
};

type MemberBillingRow = {
  id: string;
  billing_start_date: string | null;
  last_billing_check_date: string | null;
  last_due_date: string | null;
};

function currentDate() {
  return new Date().toISOString().slice(0, 10);
}

function nextDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

export function syncMemberBilling(memberId?: string, billingDate = currentDate()) {
  const contribution = getDailyContribution();
  const penaltyRate = getDailyLatePenalty();
  const members = (memberId
    ? database.prepare("select id, billing_start_date, last_billing_check_date, last_due_date from members where id = ? and role = 'MEMBER' and status = 'ACTIVE'").all(memberId)
    : database.prepare("select id, billing_start_date, last_billing_check_date, last_due_date from members where role = 'MEMBER' and status = 'ACTIVE'").all()) as MemberBillingRow[];
  const insertDue = database.prepare(`
    insert or ignore into member_dues (id, member_id, due_date, contribution_amount, quantity)
    values (?, ?, ?, ?, 1)
  `);

  const synchronize = database.transaction(() => {
    const summaries = new Map<string, BillingSummary>();
    for (const member of members) {
      const startDate = member.billing_start_date && member.billing_start_date <= billingDate
        ? member.billing_start_date
        : billingDate;
      let dueDate = member.last_due_date && member.last_due_date >= startDate
        ? nextDate(member.last_due_date)
        : startDate;
      let lastDueDate = member.last_due_date;
      while (dueDate < billingDate) {
        insertDue.run(randomUUID(), member.id, dueDate, contribution);
        lastDueDate = dueDate;
        dueDate = nextDate(dueDate);
      }
      if (lastDueDate && lastDueDate !== member.last_due_date) {
        database.prepare("update members set last_due_date = ? where id = ?").run(lastDueDate, member.id);
      }

      const initialPenaltyDate = nextDate(member.billing_start_date && member.billing_start_date <= billingDate ? member.billing_start_date : billingDate);
      let penaltyDate = member.last_billing_check_date
        ? nextDate(member.last_billing_check_date)
        : initialPenaltyDate;
      let newlyAddedPenalty = 0;
      let newlyOverdueDays = 0;
      const hasOverdueDue = database.prepare(`
        select 1 from member_dues
        where member_id = ? and due_date < ? and contribution_paid < contribution_amount
        limit 1
      `);
      const insertPenalty = database.prepare(`
        insert or ignore into member_penalties (id, member_id, penalty_date, amount)
        values (?, ?, ?, ?)
      `);
      while (penaltyDate <= billingDate) {
        if (hasOverdueDue.get(member.id, penaltyDate)) {
          const inserted = insertPenalty.run(randomUUID(), member.id, penaltyDate, penaltyRate);
          if (inserted.changes) {
            newlyAddedPenalty += penaltyRate;
            newlyOverdueDays += 1;
          }
        }
        penaltyDate = nextDate(penaltyDate);
      }
      database.prepare("update members set last_billing_check_date = ? where id = ?").run(billingDate, member.id);

      const summary = database.prepare(`
        select coalesce((select sum(contribution_amount - contribution_paid) from member_dues where member_id = ? and due_date < ?), 0)
                 + coalesce((select sum(amount - paid_amount) from member_penalties where member_id = ?), 0) as outstandingDebt,
               coalesce((select sum(case when contribution_paid < contribution_amount then quantity else 0 end) from member_dues where member_id = ? and due_date < ?), 0) as unpaidDays,
               coalesce((select sum(amount - paid_amount) from member_penalties where member_id = ?), 0) as penaltyDebt
      `).get(member.id, billingDate, member.id, member.id, billingDate, member.id) as BillingSummary;
      database.prepare("update members set outstanding_debt = ?, unpaid_days = ?, billing_migrated = 1 where id = ?")
        .run(summary.outstandingDebt, summary.unpaidDays, member.id);
      summaries.set(member.id, summary);

      if (newlyOverdueDays > 0) {
        const totalPenalty = summary.penaltyDebt.toLocaleString("fr-FR");
        const totalDebt = summary.outstandingDebt.toLocaleString("fr-FR");
        database.prepare(`
          insert or ignore into notifications (id, member_id, title, message, severity, event_key)
          values (?, ?, 'Retard de cotisation', ?, 'warning', ?)
        `).run(
          randomUUID(),
          member.id,
          `${newlyOverdueDays} jour(s) de retard supplémentaire(s). ${newlyAddedPenalty.toLocaleString("fr-FR")} FCFA de pénalité ajoutés aujourd’hui. Pénalités dues : ${totalPenalty} FCFA. Dette totale à régler : ${totalDebt} FCFA.`,
          `late-fee:${member.id}:${billingDate}`,
        );
        recordAdminActivity(member.id, "Retard de cotisation", `${newlyOverdueDays} jour(s) supplémentaire(s); ${newlyAddedPenalty.toLocaleString("fr-FR")} FCFA ajoutés. Dette totale : ${totalDebt} FCFA.`);
      }
    }
    return summaries;
  });

  return synchronize.immediate();
}

export function getMemberBillingSummary(memberId: string, billingDate = currentDate()) {
  const summaries = syncMemberBilling(memberId, billingDate);
  const summary = summaries.get(memberId);
  if (summary) return summary;
  return database.prepare(`
    select coalesce((select sum(contribution_amount - contribution_paid) from member_dues where member_id = ? and due_date < ?), 0)
             + coalesce((select sum(amount - paid_amount) from member_penalties where member_id = ?), 0) as outstandingDebt,
           coalesce((select sum(case when contribution_paid < contribution_amount then quantity else 0 end) from member_dues where member_id = ? and due_date < ?), 0) as unpaidDays,
           coalesce((select sum(amount - paid_amount) from member_penalties where member_id = ?), 0) as penaltyDebt
  `).get(memberId, billingDate, memberId, memberId, billingDate, memberId) as BillingSummary;
}

export function applyMemberPayment(memberId: string, amount: number, contributionDays = 1, billingDate = currentDate(), contributionAmount = getDailyContribution()) {
  const debtBefore = getMemberBillingSummary(memberId, billingDate).outstandingDebt;
  syncMemberBilling(memberId, billingDate);
  if (!Number.isSafeInteger(contributionDays) || contributionDays < 0 || contributionDays > 365) {
    throw new Error("INVALID_CONTRIBUTION_DAYS");
  }
  if (contributionDays > 0) {
    const insertAdvance = database.prepare(`
      insert or ignore into member_dues (id, member_id, due_date, contribution_amount, quantity)
      values (?, ?, ?, ?, 1)
    `);
    let dueDate = billingDate;
    for (let index = 0; index < contributionDays; index += 1) {
      insertAdvance.run(randomUUID(), memberId, dueDate, contributionAmount);
      dueDate = nextDate(dueDate);
    }
    const lastCoveredDate = new Date(`${billingDate}T00:00:00.000Z`);
    lastCoveredDate.setUTCDate(lastCoveredDate.getUTCDate() + contributionDays - 1);
    const lastDueDate = lastCoveredDate.toISOString().slice(0, 10);
    database.prepare(`
      update members set last_due_date = case
        when last_due_date is null or last_due_date < ? then ? else last_due_date end
      where id = ?
    `).run(lastDueDate, lastDueDate, memberId);
  }
  const penalties = database.prepare(`
    select id, amount, paid_amount as paidAmount from member_penalties
    where member_id = ? and paid_amount < amount order by penalty_date
  `).all(memberId) as { id: string; amount: number; paidAmount: number }[];
  const dues = database.prepare(`
    select id, contribution_amount, contribution_paid
    from member_dues
    where member_id = ? and contribution_paid < contribution_amount
    order by due_date
  `).all(memberId) as { id: string; contribution_amount: number; contribution_paid: number }[];
  let remaining = amount;
  const updatePenalty = database.prepare("update member_penalties set paid_amount = ? where id = ?");
  const updateDue = database.prepare(`
    update member_dues set contribution_paid = ?, updated_at = datetime('now') where id = ?
  `);

  const apply = database.transaction(() => {
    for (const penalty of penalties) {
      if (remaining <= 0) break;
      const penaltyPaid = Math.min(remaining, penalty.amount - penalty.paidAmount);
      updatePenalty.run(penalty.paidAmount + penaltyPaid, penalty.id);
      remaining -= penaltyPaid;
    }
    for (const due of dues) {
      if (remaining <= 0) break;
      let contributionPaid = due.contribution_paid;
      const contributionRemaining = due.contribution_amount - contributionPaid;
      const contributionPayment = Math.min(remaining, contributionRemaining);
      contributionPaid += contributionPayment;
      remaining -= contributionPayment;
      updateDue.run(contributionPaid, due.id);
    }

    const summary = database.prepare(`
      select coalesce((select sum(contribution_amount - contribution_paid) from member_dues where member_id = ? and due_date < ?), 0)
               + coalesce((select sum(amount - paid_amount) from member_penalties where member_id = ?), 0) as outstandingDebt,
             coalesce((select sum(case when contribution_paid < contribution_amount then quantity else 0 end) from member_dues where member_id = ? and due_date < ?), 0) as unpaidDays,
             coalesce((select sum(amount - paid_amount) from member_penalties where member_id = ?), 0) as penaltyDebt
    `).get(memberId, billingDate, memberId, memberId, billingDate, memberId) as BillingSummary;
    database.prepare("update members set outstanding_debt = ?, unpaid_days = ? where id = ?")
      .run(summary.outstandingDebt, summary.unpaidDays, memberId);
    return summary;
  });

  const summary = apply.immediate();
  const appliedToDebt = Math.min(amount, debtBefore);
  return {
    ...summary,
    appliedToDebt,
    appliedToContributions: Math.min(Math.max(0, amount - appliedToDebt), Math.max(0, amount - remaining - appliedToDebt)),
    unappliedAmount: remaining,
  };
}