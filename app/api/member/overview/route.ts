import { NextResponse, type NextRequest } from "next/server";

import { db, getDailyContribution, getDailyLatePenalty, type MemberRow } from "@/lib/database";
import { addDays, currentDate } from "@/lib/dates";
import { getMemberBillingSummary } from "@/lib/member-billing";
import { getAuthenticatedUser } from "@/lib/server-auth";

export const runtime = "nodejs";

const CALENDAR_DAYS = 14;

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Session requise." }, { status: 401 });

  const initialMember = await db.get<{ id: string }>("select id from members where user_id = ? and role = 'MEMBER'", [user.id]);
  if (!initialMember) return NextResponse.json({ error: "Aucun dossier membre n’est associé à ce compte." }, { status: 404 });
  const billing = await getMemberBillingSummary(initialMember.id);
  const member = await db.get<MemberRow>("select * from members where id = ?", [initialMember.id]);
  if (!member) return NextResponse.json({ error: "Aucun dossier membre n’est associé à ce compte." }, { status: 404 });

  const today = currentDate();
  const firstDay = addDays(today, -(CALENDAR_DAYS - 1));
  const [transactions, pendingPayments, dues, coverage, dailyContribution, dailyLatePenalty] = await Promise.all([
    db.all("select id, amount, type, method, status, reference, created_at as createdAt from transactions where member_id = ? order by created_at desc, id desc limit 10", [member.id]),
    db.all(`
      select id, amount, purpose, contribution_days as contributionDays, created_at as createdAt
      from payment_attempts
      where member_id = ? and status = 'PENDING' and gateway_session_id is not null
      order by created_at desc limit 5
    `, [member.id]),
    db.all<{ dueDate: string; amount: number; paid: number }>(`
      select due_date as dueDate, contribution_amount as amount, contribution_paid as paid
      from member_dues where member_id = ? and due_date between ? and ?
    `, [member.id, firstDay, today]),
    db.get<{ coveredUntil: string | null }>(`
      select max(due_date) as coveredUntil from member_dues
      where member_id = ? and due_date >= ? and contribution_paid >= contribution_amount
    `, [member.id, today]),
    getDailyContribution(),
    getDailyLatePenalty(),
  ]);

  const duesByDate = new Map(dues.map((due) => [due.dueDate, due]));
  const calendar = Array.from({ length: CALENDAR_DAYS }, (_, index) => {
    const date = addDays(firstDay, index);
    const due = duesByDate.get(date);
    const state = !due
      ? date === today ? "today" : "none"
      : due.paid >= due.amount ? "paid" : due.paid > 0 ? "partial" : date === today ? "today" : "unpaid";
    return { date, state };
  });

  return NextResponse.json({
    member: {
      ...member,
      daily_contribution: dailyContribution,
      daily_late_penalty: dailyLatePenalty,
      penalty_debt: billing.penaltyDebt,
      covered_until: coverage?.coveredUntil ?? null,
    },
    transactions,
    pendingPayments,
    calendar,
  }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
