import { randomUUID } from "node:crypto";

import { recordAdminActivity } from "@/lib/admin-activity";
import { db, lock, transaction, utcStamp } from "@/lib/database";
import { publicUrl, sendEmail } from "@/lib/email";
import { applyMemberPayment, getMemberBillingSummary } from "@/lib/member-billing";
import type { SasPayPayment } from "@/lib/saspay";

type PaymentAttempt = {
  id: string;
  member_id: string;
  member_name: string;
  member_first_name: string;
  member_email: string;
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

export async function settleSasPayAttempt(attemptId: string, payment: SasPayPayment) {
  const attempt = await db.get<PaymentAttempt>(`
    select payment_attempts.id, payment_attempts.member_id,
           members.first_name || ' ' || members.last_name as member_name,
           members.first_name as member_first_name, members.email as member_email,
           payment_attempts.gateway_session_id, payment_attempts.reference,
           payment_attempts.amount, payment_attempts.currency, payment_attempts.purpose,
           payment_attempts.contribution_days, payment_attempts.contribution_amount,
           payment_attempts.applied_to_debt, payment_attempts.applied_to_contributions, payment_attempts.status
    from payment_attempts
    join members on members.id = payment_attempts.member_id
    where payment_attempts.id = ?
  `, [attemptId]);

  if (!attempt) return { status: "NOT_FOUND" as const };
  if (attempt.status === "APPROVED") {
    const billing = await getMemberBillingSummary(attempt.member_id);
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

  let confirmationMessage = "";
  const status = await transaction(async (tx) => {
    // Le verrou sur la tentative empêche deux vérifications simultanées de créditer deux fois.
    await lock(tx, `payment:${attempt.id}`);
    const current = await tx.get<{ status: PaymentAttempt["status"] }>("select status from payment_attempts where id = ?", [attempt.id]);
    if (!current || current.status === "APPROVED") return current?.status ?? "NOT_FOUND";
    if (current.status === nextStatus) return current.status;

    const now = utcStamp();
    await tx.run(`
      update payment_attempts
      set status = ?, gateway_transaction_id = coalesce(?, gateway_transaction_id), updated_at = ?,
          settled_at = case when ? = 'PENDING' then settled_at else ? end
      where id = ?
    `, [nextStatus, payment.transactionId ?? null, now, nextStatus, now, attempt.id]);

    if (nextStatus === "APPROVED") {
      const billing = await getMemberBillingSummary(attempt.member_id, undefined, tx);
      const transactionType = billing.outstandingDebt > 0
        ? attempt.amount >= billing.outstandingDebt ? "DEBT_PAYMENT" : "PARTIAL_PAYMENT"
        : "CONTRIBUTION";
      await tx.run(
        "insert into transactions (id, member_id, amount, type, method, status, reference) values (?, ?, ?, ?, 'SasPay', 'SUCCESS', ?)",
        [randomUUID(), attempt.member_id, attempt.amount, transactionType, attempt.reference],
      );
      const dailyAmount = attempt.contribution_amount || Math.floor(attempt.amount / Math.max(1, attempt.contribution_days));
      const allocation = await applyMemberPayment(attempt.member_id, attempt.amount, undefined, dailyAmount || undefined, tx);
      await tx.run("update payment_attempts set applied_to_debt = ?, applied_to_contributions = ? where id = ?", [allocation.appliedToDebt, allocation.appliedToContributions, attempt.id]);
      await tx.run("update members set total_paid = total_paid + ?, last_activity = ? where id = ?", [attempt.amount, now, attempt.member_id]);
      confirmationMessage = attempt.purpose === "ARREARS"
        ? `Votre règlement de ${attempt.amount.toLocaleString("fr-FR")} FCFA pour les impayés est confirmé. Solde restant : ${allocation.outstandingDebt.toLocaleString("fr-FR")} FCFA.`
        : `Votre paiement de ${attempt.contribution_days} jour(s) est confirmé. ${allocation.appliedToDebt.toLocaleString("fr-FR")} FCFA ont d’abord été affectés aux impayés; ${allocation.appliedToContributions.toLocaleString("fr-FR")} FCFA ont réglé les cotisations choisies. Solde restant : ${allocation.outstandingDebt.toLocaleString("fr-FR")} FCFA.`;
      await tx.run(
        "insert into notifications (id, member_id, title, message, severity, event_key) values (?, ?, ?, ?, 'success', ?) on conflict do nothing",
        [randomUUID(), attempt.member_id, attempt.purpose === "ARREARS" ? "Impayés régularisés" : "Paiement confirmé", confirmationMessage, `saspay-payment:${attempt.id}:approved`],
      );
      await recordAdminActivity(attempt.member_id, attempt.purpose === "ARREARS" ? "Impayés régularisés" : "Paiement confirmé", `${confirmationMessage} Référence : ${attempt.reference}.`, tx);
    } else if (nextStatus !== "PENDING") {
      await tx.run(
        "insert into notifications (id, member_id, title, message, severity, event_key) values (?, ?, ?, ?, 'warning', ?) on conflict do nothing",
        [randomUUID(), attempt.member_id, "Paiement non confirmé", `Le paiement ${attempt.reference} n’a pas abouti (${payment.status}). Vous pouvez réessayer.`, `saspay-payment:${attempt.id}:${nextStatus.toLowerCase()}`],
      );
      await recordAdminActivity(attempt.member_id, "Paiement non abouti", `Le paiement SasPay ${attempt.reference} a le statut ${payment.status}.`, tx);
    }
    return nextStatus;
  });

  if (status === "APPROVED" && confirmationMessage) {
    await sendEmail({
      to: attempt.member_email,
      toName: attempt.member_first_name,
      subject: `Paiement confirmé : ${attempt.amount.toLocaleString("fr-FR")} FCFA`,
      title: "Votre paiement est confirmé",
      message: `${confirmationMessage} Référence : ${attempt.reference}. Votre reçu PDF est disponible dans votre espace.`,
      actionUrl: publicUrl("/dashboard"),
      actionLabel: "Voir mon solde",
    });
  }

  const billing = await getMemberBillingSummary(attempt.member_id);
  const allocation = await db.get<{ appliedToDebt: number; appliedToContributions: number }>(
    `select applied_to_debt as "appliedToDebt", applied_to_contributions as "appliedToContributions" from payment_attempts where id = ?`,
    [attempt.id],
  );
  return {
    status,
    appliedToDebt: allocation?.appliedToDebt ?? 0,
    appliedToContributions: allocation?.appliedToContributions ?? 0,
    outstandingDebt: billing.outstandingDebt,
  };
}
