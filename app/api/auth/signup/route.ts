import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

import { parseAvatar, saveAvatar } from "@/lib/avatar";
import { isUniqueViolation, publicUser, transaction, utcStamp, type UserRow } from "@/lib/database";
import { currentDate } from "@/lib/dates";
import { publicUrl, sendEmail } from "@/lib/email";
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

  if (!firstName || !lastName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^\+?\d{7,20}$/.test(normalizedPhone) || password.length < 8 || password.length > 128) {
    return NextResponse.json({ error: "Vérifiez les champs, le numéro de téléphone et le mot de passe (8 caractères minimum)." }, { status: 400 });
  }

  const avatar = parseAvatar(form.avatar);
  if (avatar === "invalid") return NextResponse.json({ error: "Photo invalide. Choisissez une image JPEG, PNG ou WebP." }, { status: 400 });

  const { hash, salt } = hashPassword(password);
  const id = randomUUID();
  const memberId = randomUUID();
  let created: UserRow | undefined;
  try {
    created = await transaction(async (tx) => {
      await tx.run(
        "insert into users (id, email, password_hash, password_salt, first_name, last_name, phone) values (?, ?, ?, ?, ?, ?, ?)",
        [id, email, hash, salt, firstName, lastName, normalizedPhone],
      );
      await tx.run(
        "insert into members (id, user_id, first_name, last_name, email, phone, daily_contribution, last_activity, billing_start_date, billing_migrated) values (?, ?, ?, ?, ?, ?, 50, ?, ?, 1)",
        [memberId, id, firstName, lastName, email, normalizedPhone, utcStamp(), currentDate()],
      );
      if (avatar) await saveAvatar(tx, id, avatar);
      await tx.run(
        "insert into notifications (id, member_id, title, message, severity) values (?, ?, ?, ?, 'success')",
        [randomUUID(), memberId, "Bienvenue dans MARYX", "Votre espace membre est prêt. Consultez votre tableau de bord pour connaître le montant actuel de la cotisation."],
      );
      await tx.run(
        "insert into admin_notifications (id, member_id, member_name, action, details) values (?, ?, ?, 'Compte créé', 'Un nouveau membre a créé son compte.')",
        [randomUUID(), memberId, `${firstName} ${lastName}`.trim()],
      );
      return tx.get<UserRow>("select id, email, first_name, last_name, phone, role, status from users where id = ?", [id]);
    });
  } catch (error) {
    if (isUniqueViolation(error)) return NextResponse.json({ error: "Un compte existe déjà avec cette adresse email." }, { status: 409 });
    throw error;
  }

  await sendEmail({
    to: email,
    toName: firstName,
    subject: "Bienvenue dans la tontine MARYX",
    title: `Bienvenue, ${firstName}`,
    message: "Votre compte membre est créé. Connectez-vous pour payer votre première cotisation et suivre vos jours dans le cercle.",
    actionUrl: publicUrl("/auth/signin"),
    actionLabel: "Me connecter",
  });

  return NextResponse.json({ user: created ? publicUser(created) : null }, { status: 201 });
}
