import { NextResponse, type NextRequest } from "next/server";

import { database, getDailyContribution, getDailyLatePenalty } from "@/lib/database";
import { getAuthenticatedUser } from "@/lib/server-auth";
import { syncMemberBilling } from "@/lib/member-billing";

export const runtime = "nodejs";

export async function PATCH(request: NextRequest) {
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

  if (hasLatePenalty) syncMemberBilling();
  const saveSettings = database.transaction(() => {
    if (hasContribution) {
      database.prepare(`
        insert into app_settings (key, value, updated_at)
        values ('daily_contribution', ?, datetime('now'))
        on conflict(key) do update set value = excluded.value, updated_at = datetime('now')
      `).run(String(amount));
    }
    if (hasLatePenalty) {
      database.prepare(`
        insert into app_settings (key, value, updated_at)
        values ('daily_late_penalty', ?, datetime('now'))
        on conflict(key) do update set value = excluded.value, updated_at = datetime('now')
      `).run(String(latePenalty));
    }
  });
  saveSettings();

  return NextResponse.json({ dailyContribution: getDailyContribution(), dailyLatePenalty: getDailyLatePenalty() }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}