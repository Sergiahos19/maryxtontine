import { NextResponse, type NextRequest } from "next/server";

import { database } from "@/lib/database";
import { getAuthenticatedUser } from "@/lib/server-auth";
import { syncMemberBilling } from "@/lib/member-billing";

export const runtime = "nodejs";

export function GET(request: NextRequest) {
  const headers = { "Cache-Control": "private, no-store" };
  const user = getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Session requise." }, { status: 401, headers });

  if (user.role === "ADMIN") {
    syncMemberBilling();
    database.prepare(`
      update admin_notifications
      set archived_at = datetime('now')
      where archived_at is null
        and (
          (action in ('Connexion', 'Déconnexion') and datetime(created_at) <= datetime('now', '-5 minutes'))
          or
          (action not in ('Connexion', 'Déconnexion') and datetime(created_at) <= datetime('now', '-3 days'))
        )
    `).run();
    const view = request.nextUrl.searchParams.get("view") === "archive" ? "archive" : "active";
    const archiveFilter = view === "archive" ? "archived_at is not null" : "archived_at is null";
    const notifications = database.prepare(`
      select id, action as title, member_name as memberName, details as message,
             read_at as readAt, created_at as createdAt, archived_at as archivedAt,
             case when action in ('Paiement non abouti', 'Retard de cotisation') then 'warning'
                  when action = 'Paiement confirmé' then 'success'
                  else 'info' end as severity
      from admin_notifications where ${archiveFilter} order by created_at desc, rowid desc
    `).all();
    const unread = database.prepare("select count(*) as count from admin_notifications where archived_at is null and read_at is null").get() as { count: number };
    const archivedUnread = database.prepare("select count(*) as count from admin_notifications where archived_at is not null and read_at is null").get() as { count: number };
    const activeCount = database.prepare("select count(*) as count from admin_notifications where archived_at is null").get() as { count: number };
    const archivedCount = database.prepare("select count(*) as count from admin_notifications where archived_at is not null").get() as { count: number };
    return NextResponse.json({
      role: user.role,
      notifications,
      unreadCount: unread.count,
      archivedUnreadCount: archivedUnread.count,
      activeCount: activeCount.count,
      archivedCount: archivedCount.count,
    }, { headers });
  }

  const member = database.prepare("select id from members where user_id = ?").get(user.id) as { id: string } | undefined;
  if (!member) return NextResponse.json({ role: user.role, notifications: [], unreadCount: 0 }, { headers });
  syncMemberBilling(member.id);

  const notifications = database
    .prepare("select id, title, message, read_at as readAt, created_at as createdAt, severity from notifications where member_id = ? order by created_at desc")
    .all(member.id);
  const unread = database.prepare("select count(*) as count from notifications where member_id = ? and read_at is null").get(member.id) as { count: number };
  return NextResponse.json({ role: user.role, notifications, unreadCount: unread.count }, { headers });
}

export async function PATCH(request: NextRequest) {
  const headers = { "Cache-Control": "private, no-store" };
  const user = getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Session requise." }, { status: 401, headers });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400, headers });
  }
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Requête invalide." }, { status: 400, headers });
  const form = body as Record<string, unknown>;
  const notificationId = String(form.notificationId ?? "");
  const markAll = form.markAll === true;
  const archived = form.archived === true;
  if (!markAll && !notificationId) return NextResponse.json({ error: "Notification invalide." }, { status: 400, headers });

  if (user.role === "ADMIN") {
    if (markAll) {
      database.prepare(`
        update admin_notifications set read_at = datetime('now')
        where read_at is null and ${archived ? "archived_at is not null" : "archived_at is null"}
      `).run();
    } else {
      database.prepare("update admin_notifications set read_at = datetime('now') where id = ?").run(notificationId);
    }
    return NextResponse.json({ success: true }, { headers });
  }

  const member = database.prepare("select id from members where user_id = ?").get(user.id) as { id: string } | undefined;
  if (!member) return NextResponse.json({ error: "Dossier membre introuvable." }, { status: 404, headers });
  if (markAll) {
    database.prepare("update notifications set read_at = datetime('now') where member_id = ? and read_at is null").run(member.id);
  } else {
    database.prepare("update notifications set read_at = datetime('now') where member_id = ? and id = ?").run(member.id, notificationId);
  }
  return NextResponse.json({ success: true }, { headers });
}
