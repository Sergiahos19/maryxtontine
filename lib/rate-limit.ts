import { db } from "@/lib/database";

// Compteurs stockés en base : en serverless, chaque requête peut tomber sur une instance différente.

export async function isRateLimited(key: string, limit: number) {
  const row = await db.get<{ count: number }>("select count from auth_attempts where key = ? and reset_at > ?", [key, new Date().toISOString()]);
  return Boolean(row && row.count >= limit);
}

export async function recordAttempt(key: string, windowMs: number) {
  const now = new Date().toISOString();
  const resetAt = new Date(Date.now() + windowMs).toISOString();
  await db.run(`
    insert into auth_attempts (key, count, reset_at) values (?, 1, ?)
    on conflict (key) do update set
      count = case when auth_attempts.reset_at <= ? then 1 else auth_attempts.count + 1 end,
      reset_at = case when auth_attempts.reset_at <= ? then excluded.reset_at else auth_attempts.reset_at end
  `, [key, resetAt, now, now]);
}

export async function clearAttempts(key: string) {
  await db.run("delete from auth_attempts where key = ?", [key]);
}

export function clientAddress(headers: Headers) {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "local";
}
