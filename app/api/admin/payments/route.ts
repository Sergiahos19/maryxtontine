import { randomBytes, randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

import { recordAdminActivity } from "@/lib/admin-activity";
import { db, transaction, utcStamp } from "@/lib/database";
import { applyMemberPayment, getMemberBillingSummary } from "@/lib/member-billing";
import { getAuthenticatedUser } from "@/lib/server-auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const admin = await getAuthenticatedUser(request);
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

  const member = await db.get<{ id: string; first_name: string; last_name: string }>("select id, first_name, last_name from members where id = ? and role = 'MEMBER'", [memberId]);
  if (!member) return NextResponse.json({ error: "Membre introuvable." }, { status: 404 });

  const transactionId = randomUUID();
  const reference = `MRY-${randomBytes(5).toString("hex").toUpperCase()}`;
  const transactionType = await transaction(async (tx) => {
    const billing = await getMemberBillingSummary(member.id, undefined, tx);
    const type = billing.outstandingDebt > 0 ? amount >= billing.outstandingDebt ? "DEBT_PAYMENT" : "PARTIAL_PAYMENT" : "CONTRIBUTION";
    await tx.run(
      "insert into transactions (id, member_id, amount, type, method, status, reference) values (?, ?, ?, ?, ?, 'SUCCESS', ?)",
      [transactionId, member.id, amount, type, method, reference],
    );
    const allocation = await applyMemberPayment(member.id, amount, undefined, undefined, tx);
    await tx.run("update members set total_paid = total_paid + ?, last_activity = ? where id = ?", [amount, utcStamp(), member.id]);
    await tx.run(
      "insert into notifications (id, member_id, title, message, severity, event_key) values (?, ?, 'Paiement enregistré', ?, 'success', ?)",
      [randomUUID(), member.id, `${amount.toLocaleString("fr-FR")} FCFA ont été enregistrés (${method}). ${allocation.appliedToDebt.toLocaleString("fr-FR")} FCFA affectés aux impayés. Référence : ${reference}.`, `manual-payment:${reference}`],
    );
    await recordAdminActivity(member.id, "Paiement enregistré", `${amount.toLocaleString("fr-FR")} FCFA reçus (${method}); ${allocation.appliedToDebt.toLocaleString("fr-FR")} FCFA affectés aux impayés. Référence : ${reference}.`, tx);
    return type;
  });

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
