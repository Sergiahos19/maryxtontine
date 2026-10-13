import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

import { database, publicUser, type UserRow } from "@/lib/database";
import { hashPassword } from "@/lib/server-auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Formulaire invalide." }, { status: 400 });

  const form = body as Record<string, unknown>;
  const firstName = String(form.firstName ?? "").trim();
  const lastName = String(form.lastName ?? "").trim();
  const email = String(form.email ?? "").trim().toLowerCase();
  const phone = String(form.phone ?? "").trim();
  const password = String(form.password ?? "");
  const normalizedPhone = phone.replace(/[\s().-]/g, "");

  if (!firstName || !lastName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^\+?\d{7,20}$/.test(normalizedPhone) || password.length < 8) {
    return NextResponse.json({ error: "Vérifiez les champs, le numéro de téléphone et le mot de passe (8 caractères minimum)." }, { status: 400 });
  }

  const { hash, salt } = hashPassword(password);
  const id = randomUUID();
  const memberId = randomUUID();
  const insertAccount = database.transaction(() => {
    database.prepare(`
      insert into users (id, email, password_hash, password_salt, first_name, last_name, phone)
      values (?, ?, ?, ?, ?, ?, ?)
    `).run(id, email, hash, salt, firstName, lastName, normalizedPhone);
    database.prepare(`
      insert into members (id, user_id, first_name, last_name, email, phone, daily_contribution, last_activity, billing_start_date, billing_migrated)
      values (?, ?, ?, ?, ?, ?, 50, datetime('now'), date('now'), 1)
    `).run(memberId, id, firstName, lastName, email, normalizedPhone);
    database.prepare(`
      insert into notifications (id, member_id, title, message, severity)
      values (?, ?, ?, ?, 'success')
    `).run(randomUUID(), memberId, "Bienvenue dans MARYX", "Votre espace membre est prêt. Consultez votre tableau de bord pour connaître le montant actuel de la cotisation.");
    database.prepare(`
      insert into admin_notifications (id, member_id, member_name, action, details)
      values (?, ?, ?, 'Compte créé', 'Un nouveau membre a créé son compte.')
    `).run(randomUUID(), memberId, `${firstName} ${lastName}`.trim());
  });

  try {
    insertAccount();
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNIQUE constraint failed: users.email")) {
      return NextResponse.json({ error: "Un compte existe déjà avec cette adresse email." }, { status: 409 });
    }
    throw error;
  }

  const created = database.prepare("select id, email, first_name, last_name, phone, role, status from users where id = ?").get(id) as UserRow;
  return NextResponse.json({ user: publicUser(created) }, { status: 201 });
}
