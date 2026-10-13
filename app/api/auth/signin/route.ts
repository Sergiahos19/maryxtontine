import { NextResponse, type NextRequest } from "next/server";

import { recordAdminActivity } from "@/lib/admin-activity";
import { db, publicUser, type UserRow } from "@/lib/database";
import { clearAttempts, clientAddress, isRateLimited, recordAttempt } from "@/lib/rate-limit";
import { issueSession, verifyPassword } from "@/lib/server-auth";

export const runtime = "nodejs";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES_PER_ACCOUNT = 5;
const MAX_FAILURES_PER_ADDRESS = 30;

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
  const password = String(body.password).slice(0, 256);
  const address = clientAddress(request.headers);
  const accountKey = `signin:${address}:${email}`;
  const addressKey = `signin:${address}`;
  if (await isRateLimited(accountKey, MAX_FAILURES_PER_ACCOUNT) || await isRateLimited(addressKey, MAX_FAILURES_PER_ADDRESS)) {
    return NextResponse.json({ error: "Trop de tentatives. Réessayez dans 15 minutes." }, { status: 429 });
  }

  const user = await db.get<UserRow & { password_hash: string; password_salt: string }>(
    "select id, email, first_name, last_name, phone, role, status, password_hash, password_salt from users where email = ?",
    [email],
  );

  if (!user || user.status !== "ACTIVE" || !verifyPassword(password, user.password_salt, user.password_hash)) {
    await recordAttempt(accountKey, WINDOW_MS);
    await recordAttempt(addressKey, WINDOW_MS);
    return NextResponse.json({ error: "Email ou mot de passe incorrect." }, { status: 401 });
  }

  await clearAttempts(accountKey);
  const response = NextResponse.json({ user: publicUser(user) });
  await issueSession(user.id, response);
  if (user.role === "MEMBER") {
    const member = await db.get<{ id: string }>("select id from members where user_id = ?", [user.id]);
    if (member) await recordAdminActivity(member.id, "Connexion", "Le membre s’est connecté à son compte.");
  }
  return response;
}
