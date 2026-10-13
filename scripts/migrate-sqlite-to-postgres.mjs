// Copie les données de l’ancienne base SQLite (data/maryx.sqlite) vers PostgreSQL (Neon).
// Usage : DATABASE_URL="postgresql://..." npm run db:migrate-sqlite
// Idempotent : une ligne déjà présente (même clé primaire) n’est ni dupliquée ni modifiée.
import path from "node:path";
import { existsSync } from "node:fs";
import Database from "better-sqlite3";
import pg from "pg";

import { SCHEMA } from "../lib/schema.ts";

const sqlitePath = process.env.MARYX_SQLITE_PATH || path.join(process.cwd(), "data", "maryx.sqlite");
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("Définissez DATABASE_URL (chaîne de connexion Neon).");
if (!existsSync(sqlitePath)) throw new Error(`Base SQLite introuvable : ${sqlitePath}`);

// Ordre imposé par les clés étrangères.
const TABLES = [
  "users",
  "members",
  "transactions",
  "notifications",
  "admin_notifications",
  "member_dues",
  "member_penalties",
  "payment_attempts",
  "sessions",
  "app_settings",
];
const CONFLICT_KEYS = { sessions: "token_hash", app_settings: "key" };

const sqlite = new Database(sqlitePath, { readonly: true, fileMustExist: true });
const client = new pg.Client({
  connectionString,
  ssl: /sslmode=(require|verify-full|verify-ca)/.test(connectionString) ? { rejectUnauthorized: false } : undefined,
});
await client.connect();

try {
  await client.query(SCHEMA);
  await client.query("begin");
  const report = [];
  for (const table of TABLES) {
    const exists = sqlite.prepare("select 1 from sqlite_master where type = 'table' and name = ?").get(table);
    if (!exists) continue;
    const targetColumns = new Set((await client.query(
      "select column_name from information_schema.columns where table_schema = 'public' and table_name = $1",
      [table],
    )).rows.map((row) => row.column_name));
    const sourceColumns = sqlite.prepare(`pragma table_info(${table})`).all().map((column) => column.name);
    const columns = sourceColumns.filter((column) => targetColumns.has(column));
    const rows = sqlite.prepare(`select ${columns.join(", ")} from ${table}`).all();
    let inserted = 0;
    for (const row of rows) {
      const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ");
      const result = await client.query(
        `insert into ${table} (${columns.join(", ")}) values (${placeholders}) on conflict (${CONFLICT_KEYS[table] ?? "id"}) do nothing`,
        columns.map((column) => row[column]),
      );
      inserted += result.rowCount ?? 0;
    }
    // Les réglages de l’ancienne base priment sur les valeurs par défaut créées avec le schéma.
    if (table === "app_settings") {
      for (const row of rows) await client.query("update app_settings set value = $1 where key = $2", [row.value, row.key]);
    }
    report.push(`${table.padEnd(20)} ${String(rows.length).padStart(5)} lues, ${String(inserted).padStart(5)} copiées`);
  }
  await client.query("commit");
  console.log("Migration terminée :\n" + report.join("\n"));
} catch (error) {
  await client.query("rollback").catch(() => undefined);
  throw error;
} finally {
  await client.end();
  sqlite.close();
}
