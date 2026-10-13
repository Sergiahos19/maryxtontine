import { NextResponse, type NextRequest } from "next/server";

import { database } from "@/lib/database";
import { getAuthenticatedUser } from "@/lib/server-auth";
import { recordAdminActivity } from "@/lib/admin-activity";
import { syncMemberBilling } from "@/lib/member-billing";

export const runtime = "nodejs";

export async function PATCH(request: NextRequest) {
  const admin = getAuthenticatedUser(request);
  if (!admin) return NextResponse.json({ error: "Session requise." }, { status: 401 });
  if (admin.role !== "ADMIN") return NextResponse.json({ error: "Accès administrateur requis." }, { status: 403 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Formulaire invalide." }, { status: 400 });

  const form = body as Record<string, unknown>;
  const memberId = String(form.memberId ?? "");
  const status = String(form.status ?? "");
  if (!memberId || !["ACTIVE", "INACTIVE", "ON_HOLD"].includes(status)) {
    return NextResponse.json({ error: "Membre ou statut invalide." }, { status: 400 });
  }

  const member = database.prepare(`
    select members.user_id, members.role as member_role, users.role as user_role,
           members.status, members.first_name, members.last_name
    from members join users on users.id = members.user_id where members.id = ?
  `).get(memberId) as { user_id: string; member_role: string; user_role: string; status: string; first_name: string; last_name: string } | undefined;
  if (!member) return NextResponse.json({ error: "Membre introuvable." }, { status: 404 });
  if (member.member_role !== "MEMBER" || member.user_role !== "MEMBER") return NextResponse.json({ error: "Seuls les comptes membres peuvent être modifiés ici." }, { status: 400 });
  if (member.user_id === admin.id && status !== "ACTIVE") {
    return NextResponse.json({ error: "Vous ne pouvez pas désactiver votre propre compte administrateur." }, { status: 400 });
  }

  if (status !== "ACTIVE") syncMemberBilling(memberId);
  const updateStatus = database.transaction(() => {
    database.prepare(`
      update members set status = ?,
        billing_start_date = case when ? = 'ACTIVE' and status != 'ACTIVE' then date('now') else billing_start_date end,
        last_billing_check_date = case when ? = 'ACTIVE' and status != 'ACTIVE' then date('now') else last_billing_check_date end
      where id = ?
    `).run(status, status, status, memberId);
    database.prepare("update users set status = ? where id = ?").run(status, member.user_id);
    if (status !== "ACTIVE") {
      database.prepare("delete from sessions where user_id = ?").run(member.user_id);
    }
  });
  updateStatus();
  const fullName = `${member.first_name} ${member.last_name}`.trim();
  const statusLabel = status === "ACTIVE" ? "réactivé" : status === "ON_HOLD" ? "mis en pause" : "désactivé";
  recordAdminActivity(memberId, "Statut modifié", `Le compte de ${fullName} a été ${statusLabel}.`);
  return NextResponse.json({ memberId, status });
}

export async function DELETE(request: NextRequest) {
  const admin = getAuthenticatedUser(request);
  if (!admin) return NextResponse.json({ error: "Session requise." }, { status: 401 });
  if (admin.role !== "ADMIN") return NextResponse.json({ error: "Accès administrateur requis." }, { status: 403 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Formulaire invalide." }, { status: 400 });

  const memberId = String((body as Record<string, unknown>).memberId ?? "");
  if (!memberId) return NextResponse.json({ error: "Membre invalide." }, { status: 400 });

  const member = database.prepare("select members.user_id, members.role as member_role, users.role as user_role from members join users on users.id = members.user_id where members.id = ?")
    .get(memberId) as { user_id: string; member_role: string; user_role: string } | undefined;
  if (!member) return NextResponse.json({ error: "Membre introuvable." }, { status: 404 });
  if (member.member_role !== "MEMBER" || member.user_role !== "MEMBER" || member.user_id === admin.id) {
    return NextResponse.json({ error: "Seuls les comptes membres peuvent être supprimés." }, { status: 400 });
  }

  database.prepare("delete from users where id = ?").run(member.user_id);
  return NextResponse.json({ memberId });
}
