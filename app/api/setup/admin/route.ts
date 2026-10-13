import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

import { isUniqueViolation, lock, publicUser, transaction, utcStamp, type UserRow } from "@/lib/database";
import { currentDate } from "@/lib/dates";
import { hashPassword, issueSession } from "@/lib/server-auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const host = request.headers.get("host")?.split(":")[0];
  const isLocalHost = host === "localhost" || host === "127.0.0.1";
  if (process.env.NODE_ENV === "production" || !isLocalHost) {
    return NextResponse.json({ error: "La création initiale est uniquement autorisée en développement local." }, { status: 403 });
  }

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
  const phone = String(form.phone ?? "").trim().replace(/[\s().-]/g, "");
  const password = String(form.password ?? "");
  if (!firstName || !lastName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^\+?\d{7,20}$/.test(phone) || password.length < 12) {
    return NextResponse.json({ error: "Renseignez tous les champs, un numéro de téléphone valide et un mot de passe de 12 caractères minimum." }, { status: 400 });
  }

  const { hash, salt } = hashPassword(password);
  const id = randomUUID();
  const memberId = randomUUID();
  let created: UserRow | undefined | false;
  try {
    created = await transaction(async (tx) => {
      await lock(tx, "setup-admin");
      if (await tx.get("select 1 from users where role = 'ADMIN' limit 1")) return false;
      await tx.run(
        "insert into users (id, email, password_hash, password_salt, first_name, last_name, phone, role) values (?, ?, ?, ?, ?, ?, ?, 'ADMIN')",
        [id, email, hash, salt, firstName, lastName, phone],
      );
      await tx.run(
        "insert into members (id, user_id, first_name, last_name, email, phone, role, daily_contribution, last_activity, billing_start_date, billing_migrated) values (?, ?, ?, ?, ?, ?, 'ADMIN', 50, ?, ?, 1)",
        [memberId, id, firstName, lastName, email, phone, utcStamp(), currentDate()],
      );
      await tx.run(
        "insert into admin_notifications (id, member_id, member_name, action, details) values (?, ?, ?, 'Compte administrateur créé', 'Le compte administrateur initial a été configuré.')",
        [randomUUID(), memberId, `${firstName} ${lastName}`.trim()],
      );
      return tx.get<UserRow>("select id, email, first_name, last_name, phone, role, status from users where id = ?", [id]);
    });
  } catch (error) {
    if (isUniqueViolation(error)) return NextResponse.json({ error: "Un compte existe déjà avec cette adresse email." }, { status: 409 });
    throw error;
  }
  if (created === false) return NextResponse.json({ error: "Le compte administrateur est déjà initialisé." }, { status: 409 });

  const response = NextResponse.json({ user: created ? publicUser(created) : null }, { status: 201 });
  await issueSession(id, response);
  return response;
}
