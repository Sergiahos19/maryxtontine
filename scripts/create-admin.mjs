import { randomBytes, randomUUID, scryptSync } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const databasePath = process.env.MARYX_DATABASE_PATH || path.join(process.cwd(), "data", "maryx.sqlite");
if (!existsSync(databasePath)) {
  throw new Error("Initialisez la base en démarrant l’application une première fois avant de créer l’administrateur.");
}

const email = process.env.MARYX_ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.MARYX_ADMIN_PASSWORD;
const firstName = process.env.MARYX_ADMIN_FIRST_NAME?.trim();
const lastName = process.env.MARYX_ADMIN_LAST_NAME?.trim();
const phone = process.env.MARYX_ADMIN_PHONE?.replace(/\s/g, "");

if (!email || !password || !firstName || !lastName || !phone) {
  throw new Error("Définissez MARYX_ADMIN_EMAIL, MARYX_ADMIN_PASSWORD, MARYX_ADMIN_FIRST_NAME, MARYX_ADMIN_LAST_NAME et MARYX_ADMIN_PHONE.");
}
if (password.length < 12 || !/^\+229\d{8,10}$/.test(phone)) {
  throw new Error("Le mot de passe doit contenir au moins 12 caractères et le téléphone doit être béninois (+229).");
}

const database = new Database(databasePath);
database.pragma("foreign_keys = ON");
const hashSalt = randomBytes(16).toString("hex");
const passwordHash = scryptSync(password, hashSalt, 64).toString("hex");
const userId = randomUUID();
const memberId = randomUUID();
const createAdmin = database.transaction(() => {
  if (database.prepare("select 1 from users where role = 'ADMIN' limit 1").get()) {
    throw new Error("Un compte administrateur existe déjà.");
  }
  database.prepare(`
    insert into users (id, email, password_hash, password_salt, first_name, last_name, phone, role)
    values (?, ?, ?, ?, ?, ?, ?, 'ADMIN')
  `).run(userId, email, passwordHash, hashSalt, firstName, lastName, phone);
  database.prepare(`
    insert into members (id, user_id, first_name, last_name, email, phone, role, daily_contribution, last_activity)
    values (?, ?, ?, ?, ?, ?, 'ADMIN', 50, datetime('now'))
  `).run(memberId, userId, firstName, lastName, email, phone);
});

try {
  createAdmin.immediate();
  console.log(`Compte administrateur créé pour ${email}. Le mot de passe n’a pas été affiché.`);
} finally {
  database.close();
}
