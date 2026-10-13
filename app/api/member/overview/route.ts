import { NextResponse, type NextRequest } from "next/server";

import { database, getDailyContribution, type MemberRow } from "@/lib/database";
import { getAuthenticatedUser } from "@/lib/server-auth";
import { getMemberBillingSummary } from "@/lib/member-billing";

export const runtime = "nodejs";

export function GET(request: NextRequest) {
  const user = getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Session requise." }, { status: 401 });

  const initialMember = database.prepare("select id from members where user_id = ?").get(user.id) as { id: string } | undefined;
  if (!initialMember) return NextResponse.json({ error: "Aucun dossier membre n’est associé à ce compte." }, { status: 404 });
  const billing = getMemberBillingSummary(initialMember.id);
  const member = database.prepare("select * from members where user_id = ?").get(user.id) as MemberRow | undefined;
  if (!member) return NextResponse.json({ error: "Aucun dossier membre n’est associé à ce compte." }, { status: 404 });
  const transactions = database
    .prepare("select id, amount, type, method, status, reference, created_at as createdAt from transactions where member_id = ? order by created_at desc limit 10")
    .all(member.id);

  return NextResponse.json({ member: { ...member, daily_contribution: getDailyContribution(), penalty_debt: billing.penaltyDebt }, transactions }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
