import { NextResponse, type NextRequest } from "next/server";

import { database, getDailyContribution, getDailyLatePenalty } from "@/lib/database";
import { getAuthenticatedUser } from "@/lib/server-auth";
import { getMemberBillingSummary, syncMemberBilling } from "@/lib/member-billing";

export const runtime = "nodejs";

export function GET(request: NextRequest) {
  const user = getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Session requise." }, { status: 401 });
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Accès administrateur requis." }, { status: 403 });

  const billing = syncMemberBilling();
  const dailyContribution = getDailyContribution();
  const dailyLatePenalty = getDailyLatePenalty();
  const members = database
    .prepare("select id, first_name as firstName, last_name as lastName, total_paid as totalPaid, outstanding_debt as outstandingDebt, unpaid_days as unpaidDays, status from members where role = 'MEMBER' order by created_at")
    .all()
    .map((member) => {
      const id = (member as { id: string }).id;
      return {
        ...member,
        dailyContribution,
        penaltyDebt: billing.get(id)?.penaltyDebt ?? getMemberBillingSummary(id).penaltyDebt,
      };
    });
  const transactions = database
    .prepare(`
      select transactions.id, transactions.amount, transactions.method, transactions.created_at as createdAt,
             members.first_name || ' ' || members.last_name as memberName
      from transactions
      join members on members.id = transactions.member_id
      order by transactions.created_at desc
      limit 10
    `)
    .all();
  return NextResponse.json({ dailyContribution, dailyLatePenalty, members, transactions }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
