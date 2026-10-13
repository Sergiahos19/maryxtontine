import { randomInt } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

import { recordAdminActivity } from "@/lib/admin-activity";
import { db, transaction } from "@/lib/database";
import { getAuthenticatedUser, hashPassword } from "@/lib/server-auth";

export const runtime = "nodejs";

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

function temporaryPassword(length = 10) {
  return Array.from({ length }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
}

export async function POST(request: NextRequest) {
  const headers = { "Cache-Control": "private, no-store" };
  const admin = await getAuthenticatedUser(request);
  if (!admin) return NextResponse.json({ error: "Session requise." }, { status: 401, headers });
  if (admin.role !== "ADMIN") return NextResponse.json({ error: "Accès administrateur requis." }, { status: 403, headers });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400, headers });
  }
  const memberId = body && typeof body === "object" ? String((body as Record<string, unknown>).memberId ?? "") : "";
  if (!memberId) return NextResponse.json({ error: "Membre invalide." }, { status: 400, headers });

  const member = await db.get<{ userId: string; role: string; firstName: string; lastName: string }>(`
    select members.user_id as userId, users.role, members.first_name as firstName, members.last_name as lastName
    from members join users on users.id = members.user_id where members.id = ?
  `, [memberId]);
  if (!member) return NextResponse.json({ error: "Membre introuvable." }, { status: 404, headers });
  if (member.role !== "MEMBER") return NextResponse.json({ error: "Seuls les mots de passe des membres peuvent être réinitialisés ici." }, { status: 400, headers });

  const password = temporaryPassword();
  const { hash, salt } = hashPassword(password);
  await transaction(async (tx) => {
    await tx.run("update users set password_hash = ?, password_salt = ? where id = ?", [hash, salt, member.userId]);
    await tx.run("delete from sessions where user_id = ?", [member.userId]);
  });
  await recordAdminActivity(memberId, "Mot de passe réinitialisé", `Un mot de passe temporaire a été généré pour ${member.firstName} ${member.lastName}.`);

  return NextResponse.json({ temporaryPassword: password }, { headers });
}
