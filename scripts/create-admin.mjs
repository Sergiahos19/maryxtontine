// Crée le premier administrateur sur la base PostgreSQL.
// Usage : DATABASE_URL=... MARYX_ADMIN_EMAIL=... MARYX_ADMIN_PASSWORD=... MARYX_ADMIN_FIRST_NAME=...
//         MARYX_ADMIN_LAST_NAME=... MARYX_ADMIN_PHONE=... npm run db:create-admin
import { randomBytes, randomUUID, scryptSync } from "node:crypto";
import pg from "pg";

import { SCHEMA } from "../lib/schema.ts";

const connectionString = process.env.DATABASE_URL;
const email = process.env.MARYX_ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.MARYX_ADMIN_PASSWORD;
const firstName = process.env.MARYX_ADMIN_FIRST_NAME?.trim();
const lastName = process.env.MARYX_ADMIN_LAST_NAME?.trim();
const phone = process.env.MARYX_ADMIN_PHONE?.replace(/[\s().-]/g, "");

if (!connectionString) throw new Error("Définissez DATABASE_URL.");
if (!email || !password || !firstName || !lastName || !phone) {
  throw new Error("Définissez MARYX_ADMIN_EMAIL, MARYX_ADMIN_PASSWORD, MARYX_ADMIN_FIRST_NAME, MARYX_ADMIN_LAST_NAME et MARYX_ADMIN_PHONE.");
}
if (password.length < 12 || !/^\+?\d{7,20}$/.test(phone)) {
  throw new Error("Le mot de passe doit contenir au moins 12 caractères et le téléphone être valide.");
}

const client = new pg.Client({
  connectionString,
  ssl: /sslmode=(require|verify-full|verify-ca)/.test(connectionString) ? { rejectUnauthorized: false } : undefined,
});
await client.connect();
try {
  await client.query(SCHEMA);
  await client.query("begin");
  if ((await client.query("select 1 from users where role = 'ADMIN' limit 1")).rowCount) {
    throw new Error("Un compte administrateur existe déjà.");
  }
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  const userId = randomUUID();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: process.env.MARYX_TIMEZONE || "Africa/Porto-Novo" }).format(new Date());
  await client.query(
    "insert into users (id, email, password_hash, password_salt, first_name, last_name, phone, role) values ($1, $2, $3, $4, $5, $6, $7, 'ADMIN')",
    [userId, email, hash, salt, firstName, lastName, phone],
  );
  await client.query(
    "insert into members (id, user_id, first_name, last_name, email, phone, role, billing_start_date) values ($1, $2, $3, $4, $5, $6, 'ADMIN', $7)",
    [randomUUID(), userId, firstName, lastName, email, phone, today],
  );
  await client.query("commit");
  console.log(`Compte administrateur créé pour ${email}. Le mot de passe n’a pas été affiché.`);
} catch (error) {
  await client.query("rollback").catch(() => undefined);
  throw error;
} finally {
  await client.end();
}
