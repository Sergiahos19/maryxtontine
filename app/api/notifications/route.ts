import { NextResponse, type NextRequest } from "next/server";

import { db, utcStamp } from "@/lib/database";
import { syncMemberBilling } from "@/lib/member-billing";
import { getAuthenticatedUser } from "@/lib/server-auth";

export const runtime = "nodejs";

const FIVE_MINUTES = 5 * 60 * 1000;
const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;

export async function GET(request: NextRequest) {
  const headers = { "Cache-Control": "private, no-store" };
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Session requise." }, { status: 401, headers });

  // Compteur seul, interrogé toutes les 30 s par la navigation : pas de recalcul de facturation.
  if (request.nextUrl.searchParams.get("summary") === "1") {
    const unread = user.role === "ADMIN"
      ? await db.get<{ count: number }>("select count(*) as count from admin_notifications where archived_at is null and read_at is null")
      : await db.get<{ count: number }>("select count(*) as count from notifications where read_at is null and member_id = (select id from members where user_id = ?)", [user.id]);
    return NextResponse.json({ unreadCount: unread?.count ?? 0 }, { headers });
  }

  if (user.role === "ADMIN") {
    await syncMemberBilling();
    // Connexions archivées après 5 minutes, le reste après 3 jours (horodatages UTC comparables comme textes).
    await db.run(`
      update admin_notifications set archived_at = ?
      where archived_at is null and (
        (action in ('Connexion', 'Déconnexion') and created_at <= ?)
        or (action not in ('Connexion', 'Déconnexion') and created_at <= ?)
      )
    `, [utcStamp(), utcStamp(-FIVE_MINUTES), utcStamp(-THREE_DAYS)]);
    const view = request.nextUrl.searchParams.get("view") === "archive" ? "archive" : "active";
    const archiveFilter = view === "archive" ? "archived_at is not null" : "archived_at is null";
    const [notifications, counts] = await Promise.all([
      db.all(`
        select id, action as title, member_name as memberName, details as message,
               read_at as readAt, created_at as createdAt, archived_at as archivedAt,
               case when action in ('Paiement non abouti', 'Retard de cotisation') then 'warning'
                    when action in ('Paiement confirmé', 'Impayés régularisés', 'Paiement enregistré') then 'success'
                    else 'info' end as severity
        from admin_notifications where ${archiveFilter} order by created_at desc, id desc
      `),
      db.get<{ unread: number; archivedUnread: number; active: number; archived: number }>(`
        select count(case when archived_at is null and read_at is null then 1 end) as unread,
               count(case when archived_at is not null and read_at is null then 1 end) as archivedUnread,
               count(case when archived_at is null then 1 end) as active,
               count(case when archived_at is not null then 1 end) as archived
        from admin_notifications
      `),
    ]);
    return NextResponse.json({
      role: user.role,
      notifications,
      unreadCount: counts?.unread ?? 0,
      archivedUnreadCount: counts?.archivedUnread ?? 0,
      activeCount: counts?.active ?? 0,
      archivedCount: counts?.archived ?? 0,
    }, { headers });
  }

  const member = await db.get<{ id: string }>("select id from members where user_id = ?", [user.id]);
  if (!member) return NextResponse.json({ role: user.role, notifications: [], unreadCount: 0 }, { headers });
  await syncMemberBilling(member.id);

  const [notifications, unread] = await Promise.all([
    db.all("select id, title, message, read_at as readAt, created_at as createdAt, severity from notifications where member_id = ? order by created_at desc, id desc", [member.id]),
    db.get<{ count: number }>("select count(*) as count from notifications where member_id = ? and read_at is null", [member.id]),
  ]);
  return NextResponse.json({ role: user.role, notifications, unreadCount: unread?.count ?? 0 }, { headers });
}

export async function PATCH(request: NextRequest) {
  const headers = { "Cache-Control": "private, no-store" };
  const user = await getAuthenticatedUser(request);
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

  const now = utcStamp();
  if (user.role === "ADMIN") {
    if (markAll) {
      await db.run(`update admin_notifications set read_at = ? where read_at is null and ${archived ? "archived_at is not null" : "archived_at is null"}`, [now]);
    } else {
      await db.run("update admin_notifications set read_at = ? where id = ?", [now, notificationId]);
    }
    return NextResponse.json({ success: true }, { headers });
  }

  const member = await db.get<{ id: string }>("select id from members where user_id = ?", [user.id]);
  if (!member) return NextResponse.json({ error: "Dossier membre introuvable." }, { status: 404, headers });
  if (markAll) {
    await db.run("update notifications set read_at = ? where member_id = ? and read_at is null", [now, member.id]);
  } else {
    await db.run("update notifications set read_at = ? where member_id = ? and id = ?", [now, member.id, notificationId]);
  }
  return NextResponse.json({ success: true }, { headers });
}
