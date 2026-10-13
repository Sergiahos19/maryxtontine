import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";

import { database, type UserRow } from "@/lib/database";

export const SESSION_COOKIE = "maryx_session";
const SESSION_DAYS = 14;

export function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  return {
    salt,
    hash: scryptSync(password, salt, 64).toString("hex"),
  };
}

export function verifyPassword(password: string, salt: string, storedHash: string) {
  const candidate = Buffer.from(scryptSync(password, salt, 64).toString("hex"), "hex");
  const expected = Buffer.from(storedHash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function issueSession(userId: string, response: NextResponse) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  database.prepare("insert into sessions (token_hash, user_id, expires_at) values (?, ?, ?)").run(hashToken(token), userId, expiresAt);
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(expiresAt),
  });
}

export function clearSession(request: NextRequest, response: NextResponse) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token) {
    database.prepare("delete from sessions where token_hash = ?").run(hashToken(token));
  }
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export function getAuthenticatedUser(request: NextRequest): UserRow | null {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const row = database
    .prepare(`
      select users.id, users.email, users.first_name, users.last_name, users.phone, users.role, users.status
      from sessions
      join users on users.id = sessions.user_id
      where sessions.token_hash = ? and julianday(sessions.expires_at) > julianday('now') and users.status = 'ACTIVE'
    `)
    .get(hashToken(token)) as UserRow | undefined;

  if (!row) {
    database.prepare("delete from sessions where token_hash = ?").run(hashToken(token));
    return null;
  }
  return row;
}
