import { NextResponse, type NextRequest } from "next/server";

import { db, getDailyContribution } from "@/lib/database";
import { currentDate } from "@/lib/dates";
import { getMemberBillingSummary, syncMemberBilling } from "@/lib/member-billing";
import { getAuthenticatedUser } from "@/lib/server-auth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const headers = { "Cache-Control": "private, no-store" };
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Session requise." }, { status: 401, headers });

  const scope = request.nextUrl.searchParams.get("scope");
  if (scope === "global") {
    await syncMemberBilling();
    const stats = await db.get(`
      select count(*) as totalMembers,
             coalesce(sum(total_paid), 0) as totalCollected,
             coalesce(sum(outstanding_debt), 0) as totalOutstanding,
             count(case when unpaid_days = 0 then 1 end) as membersUpToDate,
             count(case when unpaid_days > 0 then 1 end) as membersLate,
             count(case when status = 'ACTIVE' then 1 end) as activeMembers,
             count(case when status = 'INACTIVE' then 1 end) as inactiveMembers,
             count(case when status = 'ON_HOLD' then 1 end) as membersOnHold
      from members where role = 'MEMBER'
    `);
    return NextResponse.json({ generatedAt: new Date().toISOString(), stats }, { headers });
  }

  if (scope !== "member") {
    return NextResponse.json({ error: "Type de relevé invalide." }, { status: 400, headers });
  }

  let memberId: string | undefined;
  if (user.role === "ADMIN") {
    memberId = request.nextUrl.searchParams.get("memberId") ?? undefined;
    if (!memberId) return NextResponse.json({ error: "Membre requis pour générer ce relevé." }, { status: 400, headers });
  } else {
    const linkedMember = await db.get<{ id: string }>("select id from members where user_id = ? and role = 'MEMBER'", [user.id]);
    if (!linkedMember) return NextResponse.json({ error: "Aucun dossier membre n’est associé à ce compte." }, { status: 404, headers });
    memberId = linkedMember.id;
  }

  const member = await db.get<{
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    status: string;
    totalPaid: number;
    outstandingDebt: number;
    unpaidDays: number;
  }>(`
    select id, first_name as firstName, last_name as lastName, email, phone, status,
           total_paid as totalPaid, outstanding_debt as outstandingDebt, unpaid_days as unpaidDays
    from members where id = ? and role = 'MEMBER'
  `, [memberId]);
  if (!member) return NextResponse.json({ error: "Membre introuvable." }, { status: 404, headers });

  const billing = await getMemberBillingSummary(member.id);
  const [dues, penalties, transactions, dailyContribution] = await Promise.all([
    db.all(`
      select due_date as dueDate, contribution_amount as amount, contribution_paid as paid
      from member_dues
      where member_id = ? and due_date < ? and contribution_paid < contribution_amount
      order by due_date
    `, [member.id, currentDate()]),
    db.all(`
      select penalty_date as penaltyDate, amount, paid_amount as paid
      from member_penalties
      where member_id = ? and paid_amount < amount
      order by penalty_date
    `, [member.id]),
    db.all(`
      select id, amount, type, method, status, reference, created_at as createdAt
      from transactions where member_id = ? order by created_at desc, id desc
    `, [member.id]),
    getDailyContribution(),
  ]);

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    member: { ...member, outstandingDebt: billing.outstandingDebt, unpaidDays: billing.unpaidDays, dailyContribution, penaltyDebt: billing.penaltyDebt },
    dues,
    penalties,
    transactions,
  }, { headers });
}
