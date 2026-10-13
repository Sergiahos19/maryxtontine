import { NextResponse, type NextRequest } from "next/server";

import { database } from "@/lib/database";
import { getAuthenticatedUser } from "@/lib/server-auth";

export const runtime = "nodejs";

export function GET(request: NextRequest) {
  const user = getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Session requise." }, { status: 401 });

  const member = database.prepare("select id from members where user_id = ?").get(user.id) as { id: string } | undefined;
  if (user.role !== "ADMIN" && !member) return NextResponse.json({ error: "Aucun dossier membre n’est associé à ce compte." }, { status: 404 });
  const transactions = user.role === "ADMIN"
    ? database.prepare(`
        select transactions.id, transactions.member_id as memberId, transactions.amount, transactions.type,
               transactions.status, transactions.created_at as createdAt,
               members.first_name || ' ' || members.last_name as memberName
        from transactions join members on members.id = transactions.member_id
        order by transactions.created_at desc
      `).all()
    : database.prepare(`
        select transactions.id, transactions.member_id as memberId, transactions.amount, transactions.type,
               transactions.status, transactions.created_at as createdAt,
               members.first_name || ' ' || members.last_name as memberName
        from transactions join members on members.id = transactions.member_id
        where transactions.member_id = ?
        order by transactions.created_at desc
      `).all(member?.id);
  return NextResponse.json({ transactions });
}
