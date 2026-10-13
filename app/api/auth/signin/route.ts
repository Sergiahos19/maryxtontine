import { NextResponse, type NextRequest } from "next/server";

import { database, type UserRow, publicUser } from "@/lib/database";
import { issueSession, verifyPassword } from "@/lib/server-auth";
import { recordAdminActivity } from "@/lib/admin-activity";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || !("email" in body) || !("password" in body)) {
    return NextResponse.json({ error: "Email et mot de passe obligatoires." }, { status: 400 });
  }

  const email = String(body.email).trim().toLowerCase();
  const password = String(body.password);
  const user = database
    .prepare("select id, email, first_name, last_name, phone, role, status, password_hash, password_salt from users where email = ?")
    .get(email) as (UserRow & { password_hash: string; password_salt: string }) | undefined;

  if (!user || user.status !== "ACTIVE" || !verifyPassword(password, user.password_salt, user.password_hash)) {
    return NextResponse.json({ error: "Email ou mot de passe incorrect." }, { status: 401 });
  }

  const response = NextResponse.json({ user: publicUser(user) });
  issueSession(user.id, response);
  if (user.role === "MEMBER") {
    const member = database.prepare("select id from members where user_id = ?").get(user.id) as { id: string } | undefined;
    if (member) recordAdminActivity(member.id, "Connexion", "Le membre s’est connecté à son compte.");
  }
  return response;
}
