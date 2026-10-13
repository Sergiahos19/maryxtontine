import { randomBytes, randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

import { database, getDailyContribution } from "@/lib/database";
import { applyMemberPayment, getMemberBillingSummary } from "@/lib/member-billing";
import { recordAdminActivity } from "@/lib/admin-activity";
import { getAuthenticatedUser } from "@/lib/server-auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const admin = getAuthenticatedUser(request);
  if (!admin) return NextResponse.json({ error: "Session requise." }, { status: 401 });
  if (admin.role !== "ADMIN") return NextResponse.json({ error: "Accès administrateur requis." }, { status: 403 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Formulaire invalide." }, { status: 400 });

  const form = body as Record<string, unknown>;
  const memberId = String(form.memberId ?? "");
  const amount = Number(form.amount);
  const method = String(form.method ?? "");
  if (!memberId || !Number.isSafeInteger(amount) || amount < 1 || !["CASH", "MOBILE MONEY", "BANK TRANSFER"].includes(method)) {
    return NextResponse.json({ error: "Sélectionnez un membre, un montant entier positif et un mode valide." }, { status: 400 });
  }

  const member = database.prepare("select id, first_name, last_name from members where id = ? and role = 'MEMBER'").get(memberId) as
    | { id: string; first_name: string; last_name: string }
    | undefined;
  if (!member) return NextResponse.json({ error: "Membre introuvable." }, { status: 404 });

  const billing = getMemberBillingSummary(member.id);
  const transactionId = randomUUID();
  const reference = `MRY-${randomBytes(5).toString("hex").toUpperCase()}`;
  const transactionType = billing.outstandingDebt > 0
    ? amount >= billing.outstandingDebt ? "DEBT_PAYMENT" : "PARTIAL_PAYMENT"
    : "CONTRIBUTION";
  const daysToCover = Math.max(1, Math.ceil(Math.max(0, amount - billing.outstandingDebt) / getDailyContribution()));
  const recordPayment = database.transaction(() => {
    database.prepare(`
      insert into transactions (id, member_id, amount, type, method, status, reference)
      values (?, ?, ?, ?, ?, 'SUCCESS', ?)
    `).run(transactionId, member.id, amount, transactionType, method, reference);
    const allocation = applyMemberPayment(member.id, amount, daysToCover);
    database.prepare(`
      update members
      set total_paid = total_paid + ?, last_activity = datetime('now')
      where id = ?
    `).run(amount, member.id);
    database.prepare(`
      insert into notifications (id, member_id, title, message, severity, event_key)
      values (?, ?, 'Paiement enregistré', ?, 'success', ?)
    `).run(randomUUID(), member.id, `${amount.toLocaleString("fr-FR")} FCFA ont été enregistrés (${method}). ${allocation.appliedToDebt.toLocaleString("fr-FR")} FCFA affectés aux impayés. Référence : ${reference}.`, `manual-payment:${reference}`);
    recordAdminActivity(member.id, "Paiement enregistré", `${amount.toLocaleString("fr-FR")} FCFA reçus (${method}); ${allocation.appliedToDebt.toLocaleString("fr-FR")} FCFA affectés aux impayés. Référence : ${reference}.`);
  });
  recordPayment();

  return NextResponse.json({
    transaction: {
      id: transactionId,
      memberId: member.id,
      memberName: `${member.first_name} ${member.last_name}`,
      amount,
      method,
      type: transactionType,
      createdAt: new Date().toISOString(),
    },
  }, { status: 201 });
}
