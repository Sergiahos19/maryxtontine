import { NextResponse, type NextRequest } from "next/server";

import { recordAdminActivity } from "@/lib/admin-activity";
import { db, transaction, utcStamp } from "@/lib/database";
import { hashPassword, hashToken, passwordMinLength } from "@/lib/server-auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  const form = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const token = String(form.token ?? "");
  const password = String(form.password ?? "");
  if (!token) return NextResponse.json({ error: "Lien de réinitialisation invalide." }, { status: 400 });

  const reset = await db.get<{ userId: string; role: "ADMIN" | "MEMBER" }>(`
    select password_resets.user_id as userId, users.role
    from password_resets join users on users.id = password_resets.user_id
    where password_resets.token_hash = ? and password_resets.used_at is null and password_resets.expires_at > ?
  `, [hashToken(token), new Date().toISOString()]);
  if (!reset) return NextResponse.json({ error: "Ce lien a expiré ou a déjà été utilisé. Faites une nouvelle demande." }, { status: 400 });

  const minLength = passwordMinLength(reset.role);
  if (password.length < minLength || password.length > 128) {
    return NextResponse.json({ error: `Le mot de passe doit contenir entre ${minLength} et 128 caractères.` }, { status: 400 });
  }

  const { hash, salt } = hashPassword(password);
  await transaction(async (tx) => {
    await tx.run("update users set password_hash = ?, password_salt = ? where id = ?", [hash, salt, reset.userId]);
    await tx.run("update password_resets set used_at = ? where token_hash = ?", [utcStamp(), hashToken(token)]);
    await tx.run("delete from sessions where user_id = ?", [reset.userId]);
  });
  const member = await db.get<{ id: string }>("select id from members where user_id = ? and role = 'MEMBER'", [reset.userId]);
  if (member) await recordAdminActivity(member.id, "Mot de passe réinitialisé", "Le membre a choisi un nouveau mot de passe depuis le lien reçu par email.");

  return NextResponse.json({ message: "Mot de passe modifié. Vous pouvez vous connecter." });
}
