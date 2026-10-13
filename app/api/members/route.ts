import { NextResponse, type NextRequest } from "next/server";

import { database, getDailyContribution } from "@/lib/database";
import { getAuthenticatedUser } from "@/lib/server-auth";

export const runtime = "nodejs";

export function GET(request: NextRequest) {
  const user = getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Session requise." }, { status: 401 });

  const members = (user.role === "ADMIN"
    ? database.prepare("select id, first_name as firstName, last_name as lastName, status from members where role = 'MEMBER' order by created_at").all()
    : database.prepare("select id, first_name as firstName, last_name as lastName, status from members where user_id = ?").all(user.id))
    .map((member) => ({ ...member, dailyContribution: getDailyContribution() }));
  return NextResponse.json({ members });
}
