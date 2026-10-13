import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/lib/database";
import { isEmailConfigured, publicUrl, sendEmail } from "@/lib/email";
import { clientAddress, isRateLimited, recordAttempt } from "@/lib/rate-limit";
import { hashToken } from "@/lib/server-auth";

export const runtime = "nodejs";

const RESET_TTL_MS = 60 * 60 * 1000;

export async function POST(request: NextRequest) {
  if (!isEmailConfigured()) {
    return NextResponse.json(
      { error: "L’envoi d’emails n’est pas encore configuré. Demandez un mot de passe temporaire à l’administrateur." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  const email = body && typeof body === "object" ? String((body as Record<string, unknown>).email ?? "").trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Adresse email invalide." }, { status: 400 });

  const limitKey = `reset:${clientAddress(request.headers)}`;
  if (await isRateLimited(limitKey, 5)) return NextResponse.json({ error: "Trop de demandes. Réessayez dans une heure." }, { status: 429 });
  await recordAttempt(limitKey, RESET_TTL_MS);

  // Même réponse que le compte existe ou non, pour ne pas révéler les adresses inscrites.
  const user = await db.get<{ id: string; first_name: string }>("select id, first_name from users where email = ? and status = 'ACTIVE'", [email]);
  if (user) {
    const token = randomBytes(32).toString("base64url");
    await db.run("delete from password_resets where user_id = ? and used_at is null", [user.id]);
    await db.run("insert into password_resets (token_hash, user_id, expires_at) values (?, ?, ?)", [hashToken(token), user.id, new Date(Date.now() + RESET_TTL_MS).toISOString()]);
    await sendEmail({
      to: email,
      toName: user.first_name,
      subject: "Réinitialisez votre mot de passe MARYX",
      title: "Nouveau mot de passe",
      message: "Vous avez demandé à changer votre mot de passe. Ce lien est valable une heure. Si vous n’êtes pas à l’origine de cette demande, ignorez cet email.",
      actionUrl: publicUrl(`/auth/reset-password?token=${token}`),
      actionLabel: "Choisir un nouveau mot de passe",
    });
  }

  return NextResponse.json({ message: "Si cette adresse correspond à un compte, un lien de réinitialisation vient d’être envoyé." });
}
