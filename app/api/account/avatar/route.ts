import { NextResponse, type NextRequest } from "next/server";

import { avatarUrl, parseAvatar, saveAvatar } from "@/lib/avatar";
import { db } from "@/lib/database";
import { getAuthenticatedUser } from "@/lib/server-auth";

export const runtime = "nodejs";

export async function PUT(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Session requise." }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  const avatar = parseAvatar(body && typeof body === "object" ? (body as Record<string, unknown>).avatar : undefined);
  if (!avatar || avatar === "invalid") return NextResponse.json({ error: "Photo invalide. Choisissez une image JPEG, PNG ou WebP." }, { status: 400 });

  await saveAvatar(db, user.id, avatar);
  const row = await db.get<{ updatedAt: string }>("select updated_at as updatedAt from avatars where user_id = ?", [user.id]);
  return NextResponse.json({ avatarUrl: avatarUrl(user.id, row?.updatedAt) });
}

export async function DELETE(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Session requise." }, { status: 401 });
  await db.run("delete from avatars where user_id = ?", [user.id]);
  return NextResponse.json({ avatarUrl: null });
}
