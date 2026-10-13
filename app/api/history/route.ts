import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/lib/database";
import { getAuthenticatedUser } from "@/lib/server-auth";

export const runtime = "nodejs";

const SELECT_TRANSACTIONS = `
  select transactions.id, transactions.member_id as memberId, transactions.amount, transactions.type,
         transactions.method, transactions.reference, transactions.status, transactions.created_at as createdAt,
         members.first_name || ' ' || members.last_name as memberName
  from transactions join members on members.id = transactions.member_id
`;

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Session requise." }, { status: 401 });

  if (user.role === "ADMIN") {
    const transactions = await db.all(`${SELECT_TRANSACTIONS} order by transactions.created_at desc, transactions.id desc`);
    return NextResponse.json({ transactions }, { headers: { "Cache-Control": "private, no-store" } });
  }

  const member = await db.get<{ id: string }>("select id from members where user_id = ?", [user.id]);
  if (!member) return NextResponse.json({ error: "Aucun dossier membre n’est associé à ce compte." }, { status: 404 });
  const transactions = await db.all(`${SELECT_TRANSACTIONS} where transactions.member_id = ? order by transactions.created_at desc, transactions.id desc`, [member.id]);
  return NextResponse.json({ transactions }, { headers: { "Cache-Control": "private, no-store" } });
}
