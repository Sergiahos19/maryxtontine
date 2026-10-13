import { NextResponse, type NextRequest } from "next/server";

import { recordAdminActivity } from "@/lib/admin-activity";
import { db, isUniqueViolation, transaction } from "@/lib/database";
import { getAuthenticatedUser, hashPassword, issueSession, passwordMinLength, verifyPassword } from "@/lib/server-auth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Session requise." }, { status: 401 });

  return NextResponse.json({
    profile: {
      firstName: user.first_name,
      lastName: user.last_name,
      email: user.email,
      phone: user.phone,
      role: user.role,
    },
  }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PATCH(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Session requise." }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Formulaire invalide." }, { status: 400 });

  const form = body as Record<string, unknown>;
  const firstName = String(form.firstName ?? "").trim();
  const lastName = String(form.lastName ?? "").trim();
  const email = String(form.email ?? "").trim().toLowerCase();
  const phone = String(form.phone ?? "").trim().replace(/[\s().-]/g, "");
  if (!firstName || !lastName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^\+?\d{7,20}$/.test(phone)) {
    return NextResponse.json({ error: "Vérifiez le prénom, le nom, l’adresse email et le numéro de téléphone." }, { status: 400 });
  }

  try {
    await transaction(async (tx) => {
      await tx.run("update users set first_name = ?, last_name = ?, email = ?, phone = ? where id = ?", [firstName, lastName, email, phone, user.id]);
      await tx.run("update members set first_name = ?, last_name = ?, email = ?, phone = ? where user_id = ?", [firstName, lastName, email, phone, user.id]);
    });
    const member = await db.get<{ id: string }>("select id from members where user_id = ?", [user.id]);
    if (member) await recordAdminActivity(member.id, "Profil modifié", "Le membre a modifié ses informations personnelles.");
  } catch (error) {
    if (isUniqueViolation(error)) return NextResponse.json({ error: "Cette adresse email est déjà utilisée." }, { status: 409 });
    throw error;
  }

  return NextResponse.json({ profile: { firstName, lastName, email, phone, role: user.role } });
}

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Session requise." }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Formulaire invalide." }, { status: 400 });

  const form = body as Record<string, unknown>;
  const currentPassword = String(form.currentPassword ?? "");
  const newPassword = String(form.newPassword ?? "");
  const minLength = passwordMinLength(user.role);
  if (currentPassword.length > 128 || newPassword.length < minLength || newPassword.length > 128) {
    return NextResponse.json({ error: `Le nouveau mot de passe doit contenir entre ${minLength} et 128 caractères.` }, { status: 400 });
  }

  const credentials = await db.get<{ password_hash: string; password_salt: string }>("select password_hash, password_salt from users where id = ?", [user.id]);
  if (!credentials || !verifyPassword(currentPassword, credentials.password_salt, credentials.password_hash)) {
    return NextResponse.json({ error: "Le mot de passe actuel est incorrect." }, { status: 400 });
  }

  const { hash, salt } = hashPassword(newPassword);
  const response = NextResponse.json({ message: "Mot de passe modifié. Les autres sessions ont été déconnectées." });
  await transaction(async (tx) => {
    await tx.run("update users set password_hash = ?, password_salt = ? where id = ?", [hash, salt, user.id]);
    await tx.run("delete from sessions where user_id = ?", [user.id]);
  });
  await issueSession(user.id, response);
  const member = await db.get<{ id: string }>("select id from members where user_id = ?", [user.id]);
  if (member) await recordAdminActivity(member.id, "Mot de passe modifié", "Le membre a renouvelé son mot de passe.");
  return response;
}
