import { NextResponse, type NextRequest } from "next/server";

import { avatarUrl } from "@/lib/avatar";
import { db, getDailyContribution } from "@/lib/database";
import { currentDate } from "@/lib/dates";
import { syncMemberBilling } from "@/lib/member-billing";
import { getAuthenticatedUser } from "@/lib/server-auth";

export const runtime = "nodejs";

type CircleRow = {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  status: "ACTIVE" | "ON_HOLD";
  outstandingDebt: number;
  unpaidDays: number;
  coveredUntil: string | null;
  avatarUpdatedAt: string | null;
  joinedAt: string;
};

/**
 * Situation de chaque membre du cercle, visible par tous les membres connectés.
 * Volontairement limitée : nom, photo, statut et montant dû. Ni email ni téléphone.
 */
export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Session requise." }, { status: 401 });

  await syncMemberBilling();
  const today = currentDate();
  const [rows, dailyContribution] = await Promise.all([
    db.all<CircleRow>(`
      select members.id, members.user_id as userId, members.first_name as firstName, members.last_name as lastName,
             members.status, members.outstanding_debt as outstandingDebt, members.unpaid_days as unpaidDays,
             members.created_at as joinedAt,
             (select max(due_date) from member_dues
               where member_dues.member_id = members.id and due_date >= ? and contribution_paid >= contribution_amount) as coveredUntil,
             (select updated_at from avatars where avatars.user_id = members.user_id) as avatarUpdatedAt
      from members
      where members.role = 'MEMBER' and members.status in ('ACTIVE', 'ON_HOLD')
      order by members.outstanding_debt desc, members.first_name
    `, [today]),
    getDailyContribution(),
  ]);

  return NextResponse.json({
    dailyContribution,
    members: rows.map((row) => ({
      id: row.id,
      firstName: row.firstName,
      lastName: row.lastName,
      avatarUrl: avatarUrl(row.userId, row.avatarUpdatedAt),
      status: row.status,
      standing: row.status === "ON_HOLD" ? "paused" : row.outstandingDebt > 0 ? "late" : "ok",
      outstandingDebt: row.outstandingDebt,
      unpaidDays: row.unpaidDays,
      coveredUntil: row.coveredUntil,
      joinedAt: row.joinedAt,
      isMe: row.userId === user.id,
    })),
  }, { headers: { "Cache-Control": "private, no-store" } });
}
