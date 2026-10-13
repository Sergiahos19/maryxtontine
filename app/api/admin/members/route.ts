import { NextResponse, type NextRequest } from "next/server";

import { recordAdminActivity } from "@/lib/admin-activity";
import { db, transaction } from "@/lib/database";
import { currentDate } from "@/lib/dates";
import { syncMemberBilling } from "@/lib/member-billing";
import { getAuthenticatedUser } from "@/lib/server-auth";

export const runtime = "nodejs";

async function readBody(request: NextRequest) {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? body as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

export async function PATCH(request: NextRequest) {
  const admin = await getAuthenticatedUser(request);
  if (!admin) return NextResponse.json({ error: "Session requise." }, { status: 401 });
  if (admin.role !== "ADMIN") return NextResponse.json({ error: "Accès administrateur requis." }, { status: 403 });

  const form = await readBody(request);
  if (!form) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  const memberId = String(form.memberId ?? "");
  const status = String(form.status ?? "");
  if (!memberId || !["ACTIVE", "INACTIVE", "ON_HOLD"].includes(status)) {
    return NextResponse.json({ error: "Membre ou statut invalide." }, { status: 400 });
  }

  const member = await db.get<{ user_id: string; member_role: string; user_role: string; first_name: string; last_name: string }>(`
    select members.user_id, members.role as member_role, users.role as user_role, members.first_name, members.last_name
    from members join users on users.id = members.user_id where members.id = ?
  `, [memberId]);
  if (!member) return NextResponse.json({ error: "Membre introuvable." }, { status: 404 });
  if (member.member_role !== "MEMBER" || member.user_role !== "MEMBER") return NextResponse.json({ error: "Seuls les comptes membres peuvent être modifiés ici." }, { status: 400 });
  if (member.user_id === admin.id && status !== "ACTIVE") {
    return NextResponse.json({ error: "Vous ne pouvez pas désactiver votre propre compte administrateur." }, { status: 400 });
  }

  // Les jours dus jusqu’à aujourd’hui sont figés avant une pause ou une désactivation.
  const today = currentDate();
  if (status !== "ACTIVE") await syncMemberBilling(memberId);
  await transaction(async (tx) => {
    await tx.run(`
      update members set status = ?,
        billing_start_date = case when ? = 'ACTIVE' and status <> 'ACTIVE' then ? else billing_start_date end,
        last_billing_check_date = case when ? = 'ACTIVE' and status <> 'ACTIVE' then ? else last_billing_check_date end
      where id = ?
    `, [status, status, today, status, today, memberId]);
    await tx.run("update users set status = ? where id = ?", [status, member.user_id]);
    if (status !== "ACTIVE") await tx.run("delete from sessions where user_id = ?", [member.user_id]);
  });
  const fullName = `${member.first_name} ${member.last_name}`.trim();
  const statusLabel = status === "ACTIVE" ? "réactivé" : status === "ON_HOLD" ? "mis en pause" : "désactivé";
  await recordAdminActivity(memberId, "Statut modifié", `Le compte de ${fullName} a été ${statusLabel}.`);
  return NextResponse.json({ memberId, status });
}

export async function DELETE(request: NextRequest) {
  const admin = await getAuthenticatedUser(request);
  if (!admin) return NextResponse.json({ error: "Session requise." }, { status: 401 });
  if (admin.role !== "ADMIN") return NextResponse.json({ error: "Accès administrateur requis." }, { status: 403 });

  const form = await readBody(request);
  const memberId = String(form?.memberId ?? "");
  if (!memberId) return NextResponse.json({ error: "Membre invalide." }, { status: 400 });

  const member = await db.get<{ user_id: string; member_role: string; user_role: string }>(
    "select members.user_id, members.role as member_role, users.role as user_role from members join users on users.id = members.user_id where members.id = ?",
    [memberId],
  );
  if (!member) return NextResponse.json({ error: "Membre introuvable." }, { status: 404 });
  if (member.member_role !== "MEMBER" || member.user_role !== "MEMBER" || member.user_id === admin.id) {
    return NextResponse.json({ error: "Seuls les comptes membres peuvent être supprimés." }, { status: 400 });
  }

  await db.run("delete from users where id = ?", [member.user_id]);
  return NextResponse.json({ memberId });
}
