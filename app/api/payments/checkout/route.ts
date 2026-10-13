import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

import { recordAdminActivity } from "@/lib/admin-activity";
import { database, getDailyContribution } from "@/lib/database";
import {
  createSasPayCheckout,
  getSasPayCheckoutErrorMessage,
  SasPayApiError,
  SasPayInvalidCheckoutResponseError,
} from "@/lib/saspay";
import { getMemberBillingSummary } from "@/lib/member-billing";
import { getAuthenticatedUser } from "@/lib/server-auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const user = getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Connectez-vous pour effectuer un paiement." }, { status: 401 });

  let form: Record<string, unknown> = {};
  const requestBody = await request.text();
  if (requestBody) {
    try {
      const body: unknown = JSON.parse(requestBody);
      if (!body || typeof body !== "object") return NextResponse.json({ error: "Formulaire invalide." }, { status: 400 });
      form = body as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
    }
  }
  const purpose = form.purpose === "ARREARS" ? "ARREARS" : form.purpose === undefined || form.purpose === "CONTRIBUTION" ? "CONTRIBUTION" : "INVALID";
  const contributionDays = purpose === "CONTRIBUTION" ? Number(form.days ?? 1) : 0;
  if (purpose === "INVALID" || (purpose === "CONTRIBUTION" && (!Number.isSafeInteger(contributionDays) || contributionDays < 1 || contributionDays > 365))) {
    return NextResponse.json({ error: "Choisissez des impayés ou entre 1 et 365 jours de cotisation." }, { status: 400 });
  }

  const member = database.prepare("select id, first_name, last_name, email from members where user_id = ? and status = 'ACTIVE'")
    .get(user.id) as { id: string; first_name: string; last_name: string; email: string } | undefined;
  if (!member) return NextResponse.json({ error: "Aucun compte membre actif n’est associé à cette session." }, { status: 403 });

  const billing = getMemberBillingSummary(member.id);
  if (purpose === "ARREARS" && billing.outstandingDebt <= 0) {
    return NextResponse.json({ error: "Aucun impayé à régulariser." }, { status: 400 });
  }
  const contributionAmount = purpose === "CONTRIBUTION" ? getDailyContribution() : 0;
  const amount = purpose === "ARREARS" ? billing.outstandingDebt : contributionAmount * contributionDays;
  if (!Number.isSafeInteger(amount) || amount < 1) return NextResponse.json({ error: "Le montant calculé est invalide." }, { status: 400 });
  const attemptId = randomUUID();
  const reference = `MARYX-${attemptId.replaceAll("-", "").slice(0, 20).toUpperCase()}`;
  const configuredUrl = process.env.MARYX_PUBLIC_URL?.trim();
  if (process.env.NODE_ENV === "production" && !configuredUrl) {
    return NextResponse.json({ error: "Configurez MARYX_PUBLIC_URL pour activer le retour sécurisé du paiement." }, { status: 503 });
  }

  let returnUrl: string;
  try {
    const publicUrl = new URL(configuredUrl || request.nextUrl.origin);
    if (process.env.NODE_ENV === "production" && publicUrl.protocol !== "https:") {
      return NextResponse.json({ error: "MARYX_PUBLIC_URL doit utiliser HTTPS en production." }, { status: 503 });
    }
    if (publicUrl.protocol !== "https:" && publicUrl.protocol !== "http:") {
      return NextResponse.json({ error: "L’adresse publique de MARYX est invalide." }, { status: 503 });
    }
    const callback = new URL("/dashboard", publicUrl);
    callback.searchParams.set("payment", attemptId);
    returnUrl = callback.toString();
  } catch {
    return NextResponse.json({ error: "L’adresse de retour des paiements est invalide." }, { status: 503 });
  }

  try {
    const checkout = await createSasPayCheckout({
      amount,
      description: `${purpose === "ARREARS" ? "Régularisation des impayés" : `Cotisations MARYX (${contributionDays} jour(s))`} ${reference}`,
      email: member.email,
      customerName: `${member.first_name} ${member.last_name}`,
      attemptId,
      returnUrl,
    });

    database.prepare(`
      insert into payment_attempts (id, member_id, gateway_transaction_id, gateway_session_id, reference, amount, currency, purpose, contribution_days, contribution_amount, status, payment_url)
      values (?, ?, ?, ?, ?, ?, 'XOF', ?, ?, ?, 'PENDING', ?)
    `).run(attemptId, member.id, checkout.sessionId, checkout.sessionId, reference, amount, purpose, contributionDays, contributionAmount, checkout.checkoutUrl);
    database.prepare("insert into notifications (id, member_id, title, message, severity) values (?, ?, ?, ?, 'info')")
      .run(randomUUID(), member.id, "Paiement démarré", `${purpose === "ARREARS" ? "Régularisation des impayés" : `Cotisations pour ${contributionDays} jour(s)`} : ${amount.toLocaleString("fr-FR")} FCFA en attente de confirmation.`);
    recordAdminActivity(member.id, "Paiement démarré", `${purpose === "ARREARS" ? "Régularisation des impayés" : `${contributionDays} jour(s) de cotisation`} : ${amount.toLocaleString("fr-FR")} FCFA via SasPay. Référence : ${reference}.`);

    return NextResponse.json({ attemptId, checkoutUrl: checkout.checkoutUrl, purpose, contributionDays, amount }, {
      status: 201,
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "SASPAY_NOT_CONFIGURED") {
      return NextResponse.json({ error: "Le paiement en ligne n’est pas encore configuré. Ajoutez SASPAY_SECRET_KEY côté serveur." }, { status: 503 });
    }
    if (error instanceof SasPayApiError) {
      console.error("SasPay checkout creation failed", {
        status: error.status,
        code: error.code,
        details: error.details,
      });
    } else if (error instanceof SasPayInvalidCheckoutResponseError) {
      console.error("SasPay checkout response validation failed", {
        reason: error.reason,
        checkoutHost: error.checkoutHost,
      });
    } else {
      console.error("SasPay checkout creation failed", error instanceof Error ? error.message : "Unknown error");
    }
    const errorMessage = error instanceof SasPayInvalidCheckoutResponseError
      ? error.reason === "missing-session-id"
        ? "SasPay n’a pas renvoyé l’identifiant de session requis. Vérifiez que la clé est liée au bon compte marchand."
        : error.reason === "invalid-session-id"
          ? "SasPay a renvoyé un identifiant de session dans un format inattendu. Vérifiez l’API et le compte marchand."
          : error.reason === "missing-checkout-url"
            ? "SasPay n’a pas renvoyé le lien de paiement. Vérifiez que le compte marchand peut créer des sessions de checkout."
            : `SasPay a renvoyé un lien de paiement depuis un domaine non reconnu${error.checkoutHost ? ` (${error.checkoutHost})` : ""}.`
      : getSasPayCheckoutErrorMessage(error);
    return NextResponse.json({ error: errorMessage }, { status: 502 });
  }
}