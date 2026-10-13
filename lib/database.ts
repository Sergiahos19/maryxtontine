import pg, { type PoolClient } from "pg";

import { SCHEMA } from "@/lib/schema";

export { SCHEMA };

const { Pool, types } = pg;
type Pool = InstanceType<typeof Pool>;

// Les sommes et comptages PostgreSQL arrivent en texte (bigint, numeric) : on les veut en nombres.
types.setTypeParser(20, (value) => Number(value));
types.setTypeParser(1700, (value) => Number(value));

const globalStore = globalThis as typeof globalThis & { maryxPool?: Pool; maryxSchema?: Promise<void> };

function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL n’est pas configurée.");
  return new Pool({
    connectionString,
    // Neon impose TLS ; une base locale sans TLS reste utilisable pour le développement.
    ssl: /sslmode=(require|verify-full|verify-ca)/.test(connectionString) ? { rejectUnauthorized: false } : undefined,
    max: Number(process.env.DATABASE_POOL_MAX ?? 3),
    idleTimeoutMillis: 10_000,
  });
}

function pool() {
  globalStore.maryxPool ??= createPool();
  return globalStore.maryxPool;
}

/**
 * Convertit les marqueurs `?` en `$1, $2…` et met entre guillemets les alias camelCase
 * (`as memberName`), que PostgreSQL mettrait sinon en minuscules.
 */
export function toPg(sql: string) {
  let index = 0;
  return sql
    .replace(/\?/g, () => `$${++index}`)
    .replace(/\bas\s+([a-z][a-z0-9]*[A-Z][A-Za-z0-9]*)\b/g, 'as "$1"');
}

export type Db = {
  all<T>(sql: string, params?: unknown[]): Promise<T[]>;
  get<T>(sql: string, params?: unknown[]): Promise<T | undefined>;
  run(sql: string, params?: unknown[]): Promise<number>;
  readonly inTransaction: boolean;
};

function bind(client: Pool | PoolClient, inTransaction: boolean): Db {
  return {
    inTransaction,
    async all<T>(sql: string, params: unknown[] = []) {
      if (!inTransaction) await ensureSchema();
      return (await client.query(toPg(sql), params)).rows as T[];
    },
    async get<T>(sql: string, params: unknown[] = []) {
      if (!inTransaction) await ensureSchema();
      return (await client.query(toPg(sql), params)).rows[0] as T | undefined;
    },
    async run(sql: string, params: unknown[] = []) {
      if (!inTransaction) await ensureSchema();
      return (await client.query(toPg(sql), params)).rowCount ?? 0;
    },
  };
}

/** Accès hors transaction (une requête = une connexion empruntée au pool). */
export const db: Db = {
  inTransaction: false,
  all: (sql, params) => bind(pool(), false).all(sql, params),
  get: (sql, params) => bind(pool(), false).get(sql, params),
  run: (sql, params) => bind(pool(), false).run(sql, params),
};

/**
 * Exécute `work` dans une transaction. Appelée depuis une transaction existante,
 * elle réutilise celle-ci : les opérations restent atomiques de bout en bout.
 */
export async function transaction<T>(work: (tx: Db) => Promise<T>, parent?: Db): Promise<T> {
  if (parent?.inTransaction) return work(parent);
  await ensureSchema();
  const client = await pool().connect();
  try {
    await client.query("begin");
    const result = await work(bind(client, true));
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/** Verrou exclusif sur une ressource (un membre par exemple) jusqu’à la fin de la transaction. */
export async function lock(tx: Db, key: string) {
  await tx.get("select pg_advisory_xact_lock(hashtext(?))", [key]);
}

/** Horodatage UTC au format historique de MARYX (« AAAA-MM-JJ HH:MM:SS »). */
export function utcStamp(offsetMs = 0) {
  return new Date(Date.now() + offsetMs).toISOString().slice(0, 19).replace("T", " ");
}


/** Crée les tables au premier accès de chaque instance (idempotent). */
export function ensureSchema() {
  // Le verrou évite que deux instances serverless créent les tables en même temps.
  globalStore.maryxSchema ??= pool().query(`select pg_advisory_lock(7212026); ${SCHEMA}; select pg_advisory_unlock(7212026);`).then(() => undefined).catch((error) => {
    globalStore.maryxSchema = undefined;
    throw error;
  });
  return globalStore.maryxSchema;
}

async function readIntegerSetting(key: string, fallback: number, minimum: number, from: Db) {
  const setting = await from.get<{ value: string }>("select value from app_settings where key = ?", [key]);
  const amount = Number(setting?.value ?? fallback);
  return Number.isSafeInteger(amount) && amount >= minimum ? amount : fallback;
}

export function getDailyContribution(from: Db = db) {
  return readIntegerSetting("daily_contribution", 50, 1, from);
}

export function getDailyLatePenalty(from: Db = db) {
  return readIntegerSetting("daily_late_penalty", 25, 0, from);
}

export type UserRow = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  role: "ADMIN" | "MEMBER";
  status: "ACTIVE" | "INACTIVE" | "ON_HOLD";
  avatar_updated_at?: string | null;
};

export type MemberRow = {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  role: "ADMIN" | "MEMBER";
  status: "ACTIVE" | "INACTIVE" | "ON_HOLD";
  daily_contribution: number;
  total_paid: number;
  outstanding_debt: number;
  unpaid_days: number;
  billing_start_date: string | null;
  last_activity: string | null;
  created_at: string;
};

export function publicUser(user: UserRow) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name,
    role: user.role,
    avatarUrl: user.avatar_updated_at ? `/api/avatar/${user.id}?v=${encodeURIComponent(user.avatar_updated_at)}` : null,
  };
}

/** Code d’erreur PostgreSQL pour une contrainte d’unicité violée. */
export function isUniqueViolation(error: unknown, constraint?: string) {
  const pgError = error as { code?: string; constraint?: string };
  return pgError?.code === "23505" && (!constraint || pgError.constraint === constraint);
}
