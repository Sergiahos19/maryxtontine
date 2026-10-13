// Schéma PostgreSQL de MARYX, idempotent. Partagé par l’application et les scripts (sans dépendance).
export const SCHEMA = `
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
    created_at text not null default to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')
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
    daily_contribution integer not null default 50,
    total_paid integer not null default 0 check (total_paid >= 0),
    outstanding_debt integer not null default 0 check (outstanding_debt >= 0),
    unpaid_days integer not null default 0 check (unpaid_days >= 0),
    last_activity text,
    billing_start_date text,
    last_billing_check_date text,
    last_due_date text,
    billing_migrated integer not null default 1,
    created_at text not null default to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')
  );

  create table if not exists transactions (
    id text primary key,
    member_id text not null references members(id) on delete cascade,
    amount integer not null check (amount > 0),
    type text not null check (type in ('CONTRIBUTION', 'DEBT_PAYMENT', 'PARTIAL_PAYMENT', 'ADJUSTMENT', 'REFUND')),
    method text not null,
    status text not null default 'SUCCESS' check (status in ('PENDING', 'SUCCESS', 'FAILED')),
    reference text not null unique,
    created_at text not null default to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')
  );

  create table if not exists notifications (
    id text primary key,
    member_id text not null references members(id) on delete cascade,
    title text not null,
    message text not null,
    read_at text,
    severity text not null default 'info' check (severity in ('info', 'warning', 'success')),
    event_key text,
    created_at text not null default to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')
  );
  create unique index if not exists notifications_event_key_unique on notifications(event_key) where event_key is not null;

  create table if not exists admin_notifications (
    id text primary key,
    member_id text references members(id) on delete set null,
    member_name text not null,
    action text not null,
    details text not null,
    read_at text,
    archived_at text,
    created_at text not null default to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')
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
    created_at text not null default to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS'),
    updated_at text not null default to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS'),
    unique (member_id, due_date)
  );

  create table if not exists member_penalties (
    id text primary key,
    member_id text not null references members(id) on delete cascade,
    penalty_date text not null,
    amount integer not null check (amount >= 0),
    paid_amount integer not null default 0 check (paid_amount >= 0),
    created_at text not null default to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS'),
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
    created_at text not null default to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS'),
    updated_at text not null default to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS'),
    settled_at text
  );

  create table if not exists sessions (
    token_hash text primary key,
    user_id text not null references users(id) on delete cascade,
    expires_at text not null,
    created_at text not null default to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')
  );

  create table if not exists password_resets (
    token_hash text primary key,
    user_id text not null references users(id) on delete cascade,
    expires_at text not null,
    used_at text,
    created_at text not null default to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')
  );

  create table if not exists auth_attempts (
    key text primary key,
    count integer not null default 0,
    reset_at text not null
  );

  create table if not exists avatars (
    user_id text primary key references users(id) on delete cascade,
    mime text not null check (mime in ('image/jpeg', 'image/png', 'image/webp')),
    data bytea not null,
    updated_at text not null default to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')
  );

  create table if not exists app_settings (
    key text primary key,
    value text not null,
    updated_at text not null default to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')
  );

  insert into app_settings (key, value) values ('daily_contribution', '50') on conflict (key) do nothing;
  insert into app_settings (key, value) values ('daily_late_penalty', '25') on conflict (key) do nothing;
`;
