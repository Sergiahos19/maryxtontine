import { NextResponse, type NextRequest } from "next/server";

import { database } from "@/lib/database";
import { recordAdminActivity } from "@/lib/admin-activity";
import { clearSession, getAuthenticatedUser } from "@/lib/server-auth";

export const runtime = "nodejs";

export function POST(request: NextRequest) {
  const user = getAuthenticatedUser(request);
  if (user?.role === "MEMBER") {
    const member = database.prepare("select id from members where user_id = ?").get(user.id) as { id: string } | undefined;
    if (member) recordAdminActivity(member.id, "Déconnexion", "Le membre s’est déconnecté de son compte.");
  }
  const response = NextResponse.json({ success: true });
  clearSession(request, response);
  return response;
}
