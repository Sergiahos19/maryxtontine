import { NextResponse, type NextRequest } from "next/server";

import { database } from "@/lib/database";
import { retrieveSasPayPayment } from "@/lib/saspay";
import { settleSasPayAttempt } from "@/lib/payment-settlement";
import { getAuthenticatedUser } from "@/lib/server-auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const user = getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Session requise." }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  const attemptId = body && typeof body === "object" ? String((body as Record<string, unknown>).attemptId ?? "") : "";
  if (!/^[0-9a-f-]{36}$/i.test(attemptId)) return NextResponse.json({ error: "Référence de paiement invalide." }, { status: 400 });

  const attempt = database.prepare(`
        select payment_attempts.id, payment_attempts.gateway_session_id, payment_attempts.status,
          payment_attempts.reference, payment_attempts.amount, payment_attempts.currency,
          payment_attempts.settled_at as paidAt, payment_attempts.gateway_transaction_id as transactionId,
          payment_attempts.purpose, payment_attempts.contribution_days as contributionDays,
          payment_attempts.contribution_amount as contributionAmount,
          payment_attempts.applied_to_debt as appliedToDebt,
          payment_attempts.applied_to_contributions as appliedToContributions,
          members.outstanding_debt as outstandingDebt,
          members.first_name as firstName, members.last_name as lastName,
          members.email, members.phone
    from payment_attempts
    join members on members.id = payment_attempts.member_id
    where payment_attempts.id = ? and members.user_id = ?
  `).get(attemptId, user.id) as {
    id: string;
    gateway_session_id: string | null;
    status: string;
    reference: string;
    amount: number;
    currency: string;
    paidAt: string | null;
    transactionId: string;
    purpose: "CONTRIBUTION" | "ARREARS";
    contributionDays: number;
    contributionAmount: number;
    appliedToDebt: number;
    appliedToContributions: number;
    outstandingDebt: number;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  } | undefined;
  if (!attempt) return NextResponse.json({ error: "Paiement introuvable." }, { status: 404 });
  if (!attempt.gateway_session_id) {
    return NextResponse.json({ error: "Cette ancienne tentative ne peut pas être vérifiée avec SasPay." }, { status: 409 });
  }
  const receipt = attempt.status === "APPROVED" ? {
    reference: attempt.reference,
    transactionId: attempt.transactionId,
    paidAt: attempt.paidAt,
    member: {
      firstName: attempt.firstName,
      lastName: attempt.lastName,
      email: attempt.email,
      phone: attempt.phone,
    },
    amount: attempt.amount,
    currency: attempt.currency,
    purpose: attempt.purpose,
    contributionDays: attempt.contributionDays,
    appliedToDebt: attempt.appliedToDebt,
    appliedToContributions: attempt.appliedToContributions,
    outstandingDebt: attempt.outstandingDebt,
  } : undefined;
  if (attempt.status === "APPROVED") return NextResponse.json({
    status: attempt.status,
    purpose: attempt.purpose,
    contributionDays: attempt.contributionDays,
    contributionAmount: attempt.contributionAmount,
    coveredDays: attempt.contributionAmount > 0 ? Math.floor(attempt.appliedToContributions / attempt.contributionAmount) : 0,
    appliedToDebt: attempt.appliedToDebt,
    appliedToContributions: attempt.appliedToContributions,
    outstandingDebt: attempt.outstandingDebt,
    receipt,
  });

  try {
    const payment = await retrieveSasPayPayment(attempt.gateway_session_id);
    const result = settleSasPayAttempt(attempt.id, payment);
    const appliedToContributions = "appliedToContributions" in result ? Number(result.appliedToContributions) : attempt.appliedToContributions;
    const appliedToDebt = "appliedToDebt" in result ? Number(result.appliedToDebt) : attempt.appliedToDebt;
    const outstandingDebt = "outstandingDebt" in result ? Number(result.outstandingDebt) : attempt.outstandingDebt;
    const settledAttempt = database.prepare(`
      select settled_at as paidAt, gateway_transaction_id as transactionId,
             applied_to_debt as appliedToDebt, applied_to_contributions as appliedToContributions
      from payment_attempts where id = ?
    `).get(attempt.id) as {
      paidAt: string | null;
      transactionId: string;
      appliedToDebt: number;
      appliedToContributions: number;
    };
    const approved = result.status === "APPROVED";
    return NextResponse.json({
      ...result,
      purpose: attempt.purpose,
      contributionDays: attempt.contributionDays,
      contributionAmount: attempt.contributionAmount,
      appliedToDebt,
      appliedToContributions,
      outstandingDebt,
      coveredDays: attempt.contributionAmount > 0 ? Math.floor(appliedToContributions / attempt.contributionAmount) : 0,
      ...(approved ? {
        receipt: {
          reference: attempt.reference,
          transactionId: settledAttempt.transactionId,
          paidAt: settledAttempt.paidAt,
          member: {
            firstName: attempt.firstName,
            lastName: attempt.lastName,
            email: attempt.email,
            phone: attempt.phone,
          },
          amount: attempt.amount,
          currency: attempt.currency,
          purpose: attempt.purpose,
          contributionDays: attempt.contributionDays,
          appliedToDebt: settledAttempt.appliedToDebt,
          appliedToContributions: settledAttempt.appliedToContributions,
          outstandingDebt,
        },
      } : {}),
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof Error && error.message === "SASPAY_NOT_CONFIGURED") {
      return NextResponse.json({ error: "La vérification du paiement n’est pas encore configurée." }, { status: 503 });
    }
    console.error("SasPay payment verification failed", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "La vérification du paiement est momentanément indisponible." }, { status: 502 });
  }
}