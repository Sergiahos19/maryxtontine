import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";

const dataDirectory = path.join(process.cwd(), "data");
const databasePath = process.env.MARYX_DATABASE_PATH ?? path.join(dataDirectory, "maryx.sqlite");
mkdirSync(path.dirname(databasePath), { recursive: true });
const globalDatabase = globalThis as typeof globalThis & { maryxDatabase?: Database.Database };

export const database =
  globalDatabase.maryxDatabase ??
  new Database(databasePath);

if (process.env.NODE_ENV !== "production") globalDatabase.maryxDatabase = database;

database.pragma("foreign_keys = ON");
database.pragma("journal_mode = WAL");

database.exec(`
  create table if not exists users (
    id text primary key,
    email text not null unique,
    password_hash text not null,
    password_salt text not null,
    first_name text not null,
    last_name text not null,
    phone text not null,
    role text not null default 'MEMBER' check (role in ('ADMIN', 'MEMBER')),
    status text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE', 'ON_HOLD')),
    created_at text not null default (datetime('now'))
  );

  create table if not exists members (
    id text primary key,
    user_id text not null unique references users(id) on delete cascade,
    first_name text not null,
    last_name text not null,
    email text not null unique,
    phone text not null,
    role text not null default 'MEMBER' check (role in ('ADMIN', 'MEMBER')),
    status text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE', 'ON_HOLD')),
    daily_contribution integer not null default 50 check (daily_contribution = 50),
    total_paid integer not null default 0 check (total_paid >= 0),
    outstanding_debt integer not null default 0 check (outstanding_debt >= 0),
    unpaid_days integer not null default 0 check (unpaid_days >= 0),
    last_activity text,
    billing_start_date text,
    last_billing_check_date text,
    last_due_date text,
    created_at text not null default (datetime('now'))
  );

  create table if not exists transactions (
    id text primary key,
    member_id text not null references members(id) on delete cascade,
    amount integer not null check (amount > 0),
    type text not null check (type in ('CONTRIBUTION', 'DEBT_PAYMENT', 'PARTIAL_PAYMENT', 'ADJUSTMENT', 'REFUND')),
    method text not null,
    status text not null default 'SUCCESS' check (status in ('PENDING', 'SUCCESS', 'FAILED')),
    reference text not null unique,
    created_at text not null default (datetime('now'))
  );

  create table if not exists notifications (
    id text primary key,
    member_id text not null references members(id) on delete cascade,
    title text not null,
    message text not null,
    read_at text,
    severity text not null default 'info' check (severity in ('info', 'warning', 'success')),
    event_key text,
    created_at text not null default (datetime('now'))
  );

  create table if not exists admin_notifications (
    id text primary key,
    member_id text references members(id) on delete set null,
    member_name text not null,
    action text not null,
    details text not null,
    read_at text,
    archived_at text,
    created_at text not null default (datetime('now'))
  );

  create table if not exists member_dues (
    id text primary key,
    member_id text not null references members(id) on delete cascade,
    due_date text not null,
    contribution_amount integer not null check (contribution_amount > 0),
    quantity integer not null default 1 check (quantity > 0),
    contribution_paid integer not null default 0 check (contribution_paid >= 0),
    penalty_amount integer not null default 0 check (penalty_amount >= 0),
    penalty_paid integer not null default 0 check (penalty_paid >= 0),
    penalty_days integer not null default 0 check (penalty_days >= 0),
    created_at text not null default (datetime('now')),
    updated_at text not null default (datetime('now')),
    unique (member_id, due_date)
  );

  create table if not exists member_penalties (
    id text primary key,
    member_id text not null references members(id) on delete cascade,
    penalty_date text not null,
    amount integer not null check (amount >= 0),
    paid_amount integer not null default 0 check (paid_amount >= 0),
    created_at text not null default (datetime('now')),
    unique (member_id, penalty_date)
  );

  create table if not exists payment_attempts (
    id text primary key,
    member_id text not null references members(id) on delete cascade,
    gateway_transaction_id text not null unique,
    gateway_session_id text,
    reference text not null unique,
    amount integer not null check (amount > 0),
    currency text not null default 'XOF',
    purpose text not null default 'CONTRIBUTION' check (purpose in ('CONTRIBUTION', 'ARREARS')),
    contribution_days integer not null default 1 check (contribution_days >= 0),
    contribution_amount integer not null default 0 check (contribution_amount >= 0),
    applied_to_debt integer not null default 0 check (applied_to_debt >= 0),
    applied_to_contributions integer not null default 0 check (applied_to_contributions >= 0),
    status text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'DECLINED', 'CANCELED')),
    payment_url text not null,
    created_at text not null default (datetime('now')),
    updated_at text not null default (datetime('now')),
    settled_at text
  );

  create table if not exists sessions (
    token_hash text primary key,
    user_id text not null references users(id) on delete cascade,
    expires_at text not null,
    created_at text not null default (datetime('now'))
  );

  create table if not exists app_settings (
    key text primary key,
    value text not null,
    updated_at text not null default (datetime('now'))
  );

  insert into app_settings (key, value)
  values ('daily_contribution', '50')
  on conflict(key) do nothing;

  insert into app_settings (key, value)
  values ('daily_late_penalty', '25')
  on conflict(key) do nothing;
`);

function ensureColumn(table: string, column: string, definition: string) {
  const columns = database.prepare(`pragma table_info(${table})`).all() as { name: string }[];
  if (!columns.some((item) => item.name === column)) {
    database.exec(`alter table ${table} add column ${column} ${definition}`);
  }
}

ensureColumn("members", "billing_start_date", "text");
ensureColumn("members", "last_billing_check_date", "text");
ensureColumn("members", "last_due_date", "text");
ensureColumn("members", "billing_migrated", "integer not null default 0");
ensureColumn("notifications", "event_key", "text");
ensureColumn("admin_notifications", "read_at", "text");
ensureColumn("admin_notifications", "archived_at", "text");
ensureColumn("member_dues", "quantity", "integer not null default 1");
ensureColumn("payment_attempts", "purpose", "text not null default 'CONTRIBUTION'");
ensureColumn("payment_attempts", "contribution_days", "integer not null default 1");
ensureColumn("payment_attempts", "contribution_amount", "integer not null default 0");
ensureColumn("payment_attempts", "applied_to_debt", "integer not null default 0");
ensureColumn("payment_attempts", "applied_to_contributions", "integer not null default 0");
ensureColumn("payment_attempts", "gateway_session_id", "text");
database.exec(`
  create unique index if not exists notifications_event_key_unique
    on notifications(event_key) where event_key is not null;
`);
const unmigratedMembers = database.prepare(`
  select id, outstanding_debt as outstandingDebt, unpaid_days as unpaidDays
  from members where billing_migrated = 0
`).all() as { id: string; outstandingDebt: number; unpaidDays: number }[];
const migrationDate = (database.prepare("select date('now') as today").get() as { today: string }).today;
const migrationDueDate = (database.prepare("select date('now', '-1 day') as yesterday").get() as { yesterday: string }).yesterday;
const legacyContributionSetting = database.prepare("select value from app_settings where key = 'daily_contribution'").get() as { value: string } | undefined;
const legacyContribution = Number(legacyContributionSetting?.value ?? "50");
const preserveLegacyDue = database.prepare(`
  insert or ignore into member_dues (id, member_id, due_date, contribution_amount, quantity)
  values (?, ?, ?, ?, ?)
`);
for (const member of unmigratedMembers) {
  if (member.outstandingDebt > 0 || member.unpaidDays > 0) {
    const quantity = Math.max(1, member.unpaidDays);
    preserveLegacyDue.run(`legacy-${member.id}`, member.id, migrationDueDate, member.outstandingDebt > 0 ? member.outstandingDebt : legacyContribution * quantity, quantity);
  }
}
database.prepare("update members set billing_start_date = date('now') where billing_start_date is null").run();
database.prepare("update members set billing_migrated = 1 where billing_migrated = 0").run();

export function getDailyContribution() {
  const setting = database.prepare("select value from app_settings where key = 'daily_contribution'").get() as { value: string } | undefined;
  const amount = Number(setting?.value ?? 50);
  return Number.isSafeInteger(amount) && amount > 0 ? amount : 50;
}

export function getDailyLatePenalty() {
  const setting = database.prepare("select value from app_settings where key = 'daily_late_penalty'").get() as { value: string } | undefined;
  const amount = Number(setting?.value ?? 25);
  return Number.isSafeInteger(amount) && amount >= 0 ? amount : 25;
}

export type UserRow = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  role: "ADMIN" | "MEMBER";
  status: "ACTIVE" | "INACTIVE" | "ON_HOLD";
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
  };
}
