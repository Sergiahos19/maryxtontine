import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/lib/database";
import { getAuthenticatedUser } from "@/lib/server-auth";

export const runtime = "nodejs";

// Les photos ne sont visibles que par les personnes connectées à la tontine.
export async function GET(request: NextRequest, context: RouteContext<"/api/avatar/[userId]">) {
  const viewer = await getAuthenticatedUser(request);
  if (!viewer) return new NextResponse(null, { status: 401 });

  const { userId } = await context.params;
  const avatar = await db.get<{ mime: string; data: Buffer }>("select mime, data from avatars where user_id = ?", [userId]);
  if (!avatar) return new NextResponse(null, { status: 404 });

  return new NextResponse(new Uint8Array(avatar.data), {
    headers: {
      "Content-Type": avatar.mime,
      // L’URL contient la date de mise à jour : une nouvelle photo change l’URL.
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
