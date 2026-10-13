import { NextResponse, type NextRequest } from "next/server";

import { getDailyContribution, getDailyLatePenalty, transaction, utcStamp } from "@/lib/database";
import { syncMemberBilling } from "@/lib/member-billing";
import { getAuthenticatedUser } from "@/lib/server-auth";

export const runtime = "nodejs";

export async function PATCH(request: NextRequest) {
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
  const hasContribution = form.dailyContribution !== undefined;
  const hasLatePenalty = form.dailyLatePenalty !== undefined;
  const amount = Number(form.dailyContribution);
  const latePenalty = Number(form.dailyLatePenalty);
  if (!hasContribution && !hasLatePenalty) return NextResponse.json({ error: "Aucun réglage à modifier." }, { status: 400 });
  if (hasContribution && (!Number.isSafeInteger(amount) || amount < 1 || amount > 1_000_000_000)) {
    return NextResponse.json({ error: "Le montant de cotisation doit être un entier positif inférieur ou égal à 1 000 000 000." }, { status: 400 });
  }
  if (hasLatePenalty && (!Number.isSafeInteger(latePenalty) || latePenalty < 0 || latePenalty > 1_000_000_000)) {
    return NextResponse.json({ error: "La pénalité doit être un entier compris entre 0 et 1 000 000 000." }, { status: 400 });
  }

  // Fige les échéances et pénalités déjà dues avec les anciens montants avant de changer les tarifs.
  await syncMemberBilling();
  await transaction(async (tx) => {
    const upsert = "insert into app_settings (key, value, updated_at) values (?, ?, ?) on conflict (key) do update set value = excluded.value, updated_at = excluded.updated_at";
    if (hasContribution) await tx.run(upsert, ["daily_contribution", String(amount), utcStamp()]);
    if (hasLatePenalty) await tx.run(upsert, ["daily_late_penalty", String(latePenalty), utcStamp()]);
  });

  return NextResponse.json({ dailyContribution: await getDailyContribution(), dailyLatePenalty: await getDailyLatePenalty() }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
