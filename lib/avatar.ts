import { utcStamp, type Db } from "@/lib/database";

const MAX_BYTES = 300 * 1024;
const DATA_URL = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/;

export type AvatarInput = { mime: string; data: Buffer };

/** Valide une photo envoyée en data URL (déjà redimensionnée côté navigateur). */
export function parseAvatar(value: unknown): AvatarInput | null | "invalid" {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return "invalid";
  const match = DATA_URL.exec(value);
  if (!match) return "invalid";
  const data = Buffer.from(match[2], "base64");
  if (!data.length || data.length > MAX_BYTES) return "invalid";
  return { mime: match[1], data };
}

export async function saveAvatar(db: Db, userId: string, avatar: AvatarInput) {
  await db.run(`
    insert into avatars (user_id, mime, data, updated_at) values (?, ?, ?, ?)
    on conflict (user_id) do update set mime = excluded.mime, data = excluded.data, updated_at = excluded.updated_at
  `, [userId, avatar.mime, avatar.data, utcStamp()]);
}

/** URL publique (pour les membres connectés) de la photo, avec version pour le cache. */
export function avatarUrl(userId: string, updatedAt: string | null | undefined) {
  return updatedAt ? `/api/avatar/${userId}?v=${encodeURIComponent(updatedAt)}` : null;
}
