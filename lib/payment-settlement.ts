import { randomUUID } from "node:crypto";

import { database } from "@/lib/database";
import { recordAdminActivity } from "@/lib/admin-activity";
import { applyMemberPayment, getMemberBillingSummary } from "@/lib/member-billing";
import type { SasPayPayment } from "@/lib/saspay";

type PaymentAttempt = {
  id: string;
  member_id: string;
  member_name: string;
  gateway_transaction_id: string;
  gateway_session_id: string | null;
  reference: string;
  amount: number;
  currency: string;
  purpose: "CONTRIBUTION" | "ARREARS";
  contribution_days: number;
  contribution_amount: number;
  applied_to_debt: number;
  applied_to_contributions: number;
  status: "PENDING" | "APPROVED" | "DECLINED" | "CANCELED";
};

export function settleSasPayAttempt(attemptId: string, payment: SasPayPayment) {
  const attempt = database.prepare(`
    select payment_attempts.id, payment_attempts.member_id,
           members.first_name || ' ' || members.last_name as member_name,
           payment_attempts.gateway_transaction_id, payment_attempts.gateway_session_id, payment_attempts.reference,
           payment_attempts.amount, payment_attempts.currency, payment_attempts.purpose,
           payment_attempts.contribution_days, payment_attempts.contribution_amount,
           payment_attempts.applied_to_debt, payment_attempts.applied_to_contributions, payment_attempts.status
    from payment_attempts
    join members on members.id = payment_attempts.member_id
    where payment_attempts.id = ?
  `).get(attemptId) as PaymentAttempt | undefined;

  if (!attempt) return { status: "NOT_FOUND" as const };
  if (attempt.status === "APPROVED") {
    const billing = getMemberBillingSummary(attempt.member_id);
    return {
      status: attempt.status,
      appliedToDebt: attempt.applied_to_debt,
      appliedToContributions: attempt.applied_to_contributions,
      outstandingDebt: billing.outstandingDebt,
    };
  }
  if (!attempt.gateway_session_id || attempt.gateway_session_id !== payment.checkoutSessionId) {
    throw new Error("PAYMENT_SESSION_MISMATCH");
  }
  if (payment.status === "SUCCESS") {
    if (!payment.transactionId || attempt.amount !== payment.amount) throw new Error("PAYMENT_DETAILS_MISMATCH");
    if (payment.currency !== attempt.currency) throw new Error("PAYMENT_CURRENCY_MISMATCH");
  }

  const nextStatus = payment.status === "SUCCESS"
    ? "APPROVED"
    : payment.status === "FAILED"
      ? "DECLINED"
      : payment.status === "CANCELLED" || payment.status === "EXPIRED"
        ? "CANCELED"
        : "PENDING";

  const update = database.transaction(() => {
    const current = database.prepare("select status from payment_attempts where id = ?").get(attempt.id) as { status: PaymentAttempt["status"] } | undefined;
    if (!current || current.status === "APPROVED") return current?.status ?? "NOT_FOUND";
    if (current.status === nextStatus) return current.status;

    database.prepare(`
      update payment_attempts
      set status = ?, gateway_transaction_id = coalesce(?, gateway_transaction_id),
          updated_at = datetime('now'),
          settled_at = case when ? = 'PENDING' then settled_at else datetime('now') end
      where id = ?
    `).run(nextStatus, payment.transactionId ?? null, nextStatus, attempt.id);

    if (nextStatus === "APPROVED") {
      const billing = getMemberBillingSummary(attempt.member_id);
      const transactionType = billing.outstandingDebt > 0
        ? attempt.amount >= billing.outstandingDebt ? "DEBT_PAYMENT" : "PARTIAL_PAYMENT"
        : "CONTRIBUTION";
      database.prepare(`
        insert into transactions (id, member_id, amount, type, method, status, reference)
        values (?, ?, ?, ?, 'SasPay', 'SUCCESS', ?)
      `).run(randomUUID(), attempt.member_id, attempt.amount, transactionType, attempt.reference);
      const dailyAmount = attempt.contribution_amount || Math.floor(attempt.amount / Math.max(1, attempt.contribution_days));
      const allocation = applyMemberPayment(
        attempt.member_id,
        attempt.amount,
        attempt.purpose === "ARREARS" ? 0 : attempt.contribution_days,
        undefined,
        dailyAmount,
      );
      database.prepare(`
        update payment_attempts
        set applied_to_debt = ?, applied_to_contributions = ?
        where id = ?
      `).run(allocation.appliedToDebt, allocation.appliedToContributions, attempt.id);
      database.prepare(`
        update members
        set total_paid = total_paid + ?, last_activity = datetime('now')
        where id = ?
      `).run(attempt.amount, attempt.member_id);
      const paymentMessage = attempt.purpose === "ARREARS"
        ? `Votre règlement de ${attempt.amount.toLocaleString("fr-FR")} FCFA pour les impayés est confirmé. Solde restant : ${allocation.outstandingDebt.toLocaleString("fr-FR")} FCFA.`
        : `Votre paiement de ${attempt.contribution_days} jour(s) est confirmé. ${allocation.appliedToDebt.toLocaleString("fr-FR")} FCFA ont d’abord été affectés aux impayés; ${allocation.appliedToContributions.toLocaleString("fr-FR")} FCFA ont réglé les cotisations choisies. Solde restant : ${allocation.outstandingDebt.toLocaleString("fr-FR")} FCFA.`;
      database.prepare("insert into notifications (id, member_id, title, message, severity, event_key) values (?, ?, ?, ?, 'success', ?)")
        .run(randomUUID(), attempt.member_id, attempt.purpose === "ARREARS" ? "Impayés régularisés" : "Paiement confirmé", paymentMessage, `saspay-payment:${attempt.id}:approved`);
      recordAdminActivity(attempt.member_id, attempt.purpose === "ARREARS" ? "Impayés régularisés" : "Paiement confirmé", `${paymentMessage} Référence : ${attempt.reference}.`);
    } else if (nextStatus !== "PENDING") {
      database.prepare("insert into notifications (id, member_id, title, message, severity, event_key) values (?, ?, ?, ?, 'warning', ?)")
        .run(randomUUID(), attempt.member_id, "Paiement non confirmé", `Le paiement ${attempt.reference} n’a pas abouti (${payment.status}). Vous pouvez réessayer.`, `saspay-payment:${attempt.id}:${nextStatus.toLowerCase()}`);
      recordAdminActivity(attempt.member_id, "Paiement non abouti", `Le paiement SasPay ${attempt.reference} a le statut ${payment.status}.`);
    }

    return nextStatus;
  });

  const status = update.immediate();
  const billing = getMemberBillingSummary(attempt.member_id);
  const allocation = database.prepare("select applied_to_debt as appliedToDebt, applied_to_contributions as appliedToContributions from payment_attempts where id = ?")
    .get(attempt.id) as { appliedToDebt: number; appliedToContributions: number } | undefined;
  return {
    status,
    appliedToDebt: allocation?.appliedToDebt ?? 0,
    appliedToContributions: allocation?.appliedToContributions ?? 0,
    outstandingDebt: billing.outstandingDebt,
  };
}