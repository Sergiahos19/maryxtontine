import { NextResponse, type NextRequest } from "next/server";

import { recordAdminActivity } from "@/lib/admin-activity";
import { db } from "@/lib/database";
import { clearSession, getAuthenticatedUser } from "@/lib/server-auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (user?.role === "MEMBER") {
    const member = await db.get<{ id: string }>("select id from members where user_id = ?", [user.id]);
    if (member) await recordAdminActivity(member.id, "Déconnexion", "Le membre s’est déconnecté de son compte.");
  }
  const response = NextResponse.json({ success: true });
  await clearSession(request, response);
  return response;
}
