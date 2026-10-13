import { NextResponse, type NextRequest } from "next/server";

import { avatarUrl } from "@/lib/avatar";
import { db, getDailyContribution, getDailyLatePenalty } from "@/lib/database";
import { syncMemberBilling } from "@/lib/member-billing";
import { getAuthenticatedUser } from "@/lib/server-auth";

export const runtime = "nodejs";

type OverviewMember = { id: string; firstName: string; lastName: string; totalPaid: number; outstandingDebt: number; unpaidDays: number; status: string };

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Session requise." }, { status: 401 });
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Accès administrateur requis." }, { status: 403 });

  await syncMemberBilling();
  const [dailyContribution, dailyLatePenalty] = await Promise.all([getDailyContribution(), getDailyLatePenalty()]);
  const members = await db.all<OverviewMember & { penaltyDebt: number; userId: string; avatarUpdatedAt: string | null }>(`
    select id, user_id as userId, (select updated_at from avatars where avatars.user_id = members.user_id) as avatarUpdatedAt, first_name as firstName, last_name as lastName, total_paid as totalPaid,
           outstanding_debt as outstandingDebt, unpaid_days as unpaidDays, status,
           coalesce((select sum(amount - paid_amount) from member_penalties where member_penalties.member_id = members.id), 0) as penaltyDebt
    from members where role = 'MEMBER' order by created_at
  `);
  const transactions = await db.all(`
    select transactions.id, transactions.amount, transactions.type, transactions.method, transactions.created_at as createdAt,
           members.first_name || ' ' || members.last_name as memberName
    from transactions
    join members on members.id = transactions.member_id
    order by transactions.created_at desc
    limit 10
  `);
  return NextResponse.json({
    dailyContribution,
    dailyLatePenalty,
    members: members.map(({ userId, avatarUpdatedAt, ...member }) => ({ ...member, avatarUrl: avatarUrl(userId, avatarUpdatedAt), dailyContribution })),
    transactions,
  }, { headers: { "Cache-Control": "private, no-store" } });
}
