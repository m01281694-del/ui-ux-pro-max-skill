-- RELANCEO — schéma multi-entreprises (Postgres 15+, compatible Supabase).
-- Rôles : "authenticated" (utilisateur connecté, soumis aux politiques RLS)
--         "service_role"  (serveur : webhooks de paiement, planificateur ; bypass RLS)
-- Sur Supabase ces deux rôles existent déjà ; le bloc ci-dessous ne les crée que s'ils manquent.

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end $$;

create schema if not exists app;

-- ---------------------------------------------------------------- catalogue
create table if not exists app_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists plans (
  id text primary key,
  name text not null,
  price_cents integer not null check (price_cents >= 0),
  currency text not null,
  interval text not null check (interval in ('month')),
  catalog_version integer not null,
  updated_at timestamptz not null default now()
);

create table if not exists plan_permissions (
  plan_id text not null references plans(id) on delete cascade,
  permission text not null,
  primary key (plan_id, permission)
);

create table if not exists plan_limits (
  plan_id text not null references plans(id) on delete cascade,
  metric text not null,
  limit_value bigint not null check (limit_value >= 0),
  primary key (plan_id, metric)
);

create table if not exists role_permissions (
  role text not null,
  permission text not null,
  primary key (role, permission)
);

create table if not exists access_policy_permissions (
  mode text not null check (mode in ('readonly')),
  permission text not null,
  primary key (mode, permission)
);

-- ---------------------------------------------------------------- comptes
create table if not exists tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 200),
  created_at timestamptz not null default now()
);

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (position('@' in email) > 1),
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member')),
  status text not null default 'active' check (status in ('active', 'suspended_over_limit', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);

create table if not exists invitations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin', 'member')),
  token_hash text not null unique,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'suspended_over_limit')),
  invited_by uuid references users(id),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists sessions (
  token_hash text primary key,
  user_id uuid not null references users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- abonnement
create table if not exists subscriptions (
  tenant_id uuid primary key references tenants(id) on delete cascade,
  plan_id text not null references plans(id),
  status text not null check (status in ('incomplete', 'active', 'past_due', 'suspended', 'canceled')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  past_due_since timestamptz,
  scheduled_plan_id text references plans(id),
  provider text not null default 'none' check (provider in ('none', 'manual', 'stripe')),
  provider_customer_id text unique,
  provider_subscription_id text unique,
  provider_updated_at timestamptz,
  updated_at timestamptz not null default now()
);

-- Offre personnalisée : dérogation de quota pour une entreprise, validée par un opérateur.
create table if not exists tenant_limit_overrides (
  tenant_id uuid not null references tenants(id) on delete cascade,
  metric text not null,
  limit_value bigint not null check (limit_value >= 0),
  reason text not null,
  approved_by text not null,
  created_at timestamptz not null default now(),
  primary key (tenant_id, metric)
);

create table if not exists subscription_audit_log (
  id bigserial primary key,
  tenant_id uuid not null,
  actor text not null,
  action text not null,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);

create table if not exists plan_change_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  requested_by uuid references users(id),
  from_plan text not null,
  to_plan text not null,
  kind text not null check (kind in ('upgrade', 'downgrade', 'cancel', 'resume')),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'failed', 'billing_disabled')),
  provider_reference text,
  created_at timestamptz not null default now()
);

create table if not exists billing_events (
  id text primary key,                       -- identifiant d'événement du prestataire (idempotence)
  provider text not null,
  type text not null,
  event_created_at timestamptz,
  status text not null default 'received' check (status in ('received', 'processed', 'ignored', 'ignored_stale', 'failed')),
  tenant_id uuid,
  error text,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

-- ---------------------------------------------------------------- quotas
create table if not exists usage_counters (
  tenant_id uuid not null references tenants(id) on delete cascade,
  metric text not null,
  period_start timestamptz not null,
  period_end timestamptz not null,
  used bigint not null default 0 check (used >= 0),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, metric, period_start)
);

create table if not exists usage_events (
  id bigserial primary key,
  tenant_id uuid not null references tenants(id) on delete cascade,
  metric text not null,
  amount integer not null check (amount > 0),
  idempotency_key text,
  ref_id uuid,
  period_start timestamptz not null,
  actor_user_id uuid,
  refunded boolean not null default false,
  created_at timestamptz not null default now(),
  unique (tenant_id, metric, idempotency_key)
);

create table if not exists quota_alerts (
  tenant_id uuid not null references tenants(id) on delete cascade,
  metric text not null,
  period_start timestamptz not null,
  threshold integer not null,
  created_at timestamptz not null default now(),
  primary key (tenant_id, metric, period_start, threshold)
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  kind text not null,
  message text not null,
  data jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- métier
create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null check (length(name) between 1 and 200),
  email text,
  phone text,
  notes text,
  opted_out_at timestamptz,
  unsubscribe_token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  customer_id uuid references customers(id) on delete set null,
  subject text not null check (length(subject) between 1 and 300),
  body text not null default '' check (length(body) <= 20000),
  status text not null default 'new' check (status in ('new', 'in_progress', 'waiting_customer', 'closed')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  due_at timestamptz,
  channel text not null default 'manual' check (channel in ('manual', 'email', 'phone', 'form', 'other')),
  category text,
  ai_summary text,
  reply_token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  first_response_at timestamptz,
  closed_at timestamptz,
  last_outbound_at timestamptz,
  last_customer_reply_at timestamptz
);
create index if not exists requests_tenant_status on requests(tenant_id, status);

create table if not exists request_events (
  id bigserial primary key,
  tenant_id uuid not null references tenants(id) on delete cascade,
  request_id uuid not null references requests(id) on delete cascade,
  kind text not null,
  data jsonb not null default '{}',
  actor_user_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists reminders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  request_id uuid not null references requests(id) on delete cascade,
  due_at timestamptz not null,
  note text not null default '',
  done_at timestamptz,
  created_by uuid references users(id),
  created_at timestamptz not null default now()
);

create table if not exists message_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null check (length(name) between 1 and 120),
  subject text not null default '' check (length(subject) <= 300),
  body text not null check (length(body) between 1 and 10000),
  status text not null default 'draft' check (status in ('draft', 'approved', 'archived')),
  approved_by uuid references users(id),
  approved_at timestamptz,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists automation_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null check (length(name) between 1 and 120),
  template_id uuid references message_templates(id),
  trigger text not null default 'no_customer_reply' check (trigger in ('no_customer_reply')),
  delay_hours integer not null check (delay_hours between 24 and 720),
  max_attempts integer not null default 2 check (max_attempts between 1 and 5),
  conditions jsonb not null default '{"statuses": ["waiting_customer"]}',
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'paused_by_plan')),
  authorized_by uuid references users(id),
  authorized_at timestamptz,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists automation_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  rule_id uuid not null references automation_rules(id) on delete cascade,
  request_id uuid not null references requests(id) on delete cascade,
  attempt integer not null check (attempt >= 1),
  scheduled_for timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed', 'skipped', 'canceled', 'needs_review')),
  reason text,
  tries integer not null default 0,
  last_error text,
  message_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (rule_id, request_id, attempt)          -- anti-doublon structurel
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  request_id uuid not null references requests(id) on delete cascade,
  direction text not null check (direction in ('inbound', 'outbound')),
  origin text not null check (origin in ('manual', 'automation', 'inbound_webhook')),
  subject text,
  body text not null default '',
  status text not null check (status in ('logged', 'queued', 'sent', 'failed', 'received')),
  provider_message_id text,
  error text,
  automation_job_id uuid references automation_jobs(id),
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create table if not exists tenant_settings (
  tenant_id uuid primary key references tenants(id) on delete cascade,
  automations_paused boolean not null default false,
  automation_hourly_cap integer not null default 50 check (automation_hourly_cap between 1 and 500),
  sender_name text,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- coûts
create table if not exists cost_ledger (
  id bigserial primary key,
  tenant_id uuid references tenants(id) on delete set null,
  category text not null check (category in ('ai', 'email', 'sms', 'payment', 'storage', 'other')),
  units numeric not null,
  amount_eur numeric(12, 6) not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists internal_alerts (
  id bigserial primary key,
  tenant_id uuid,
  kind text not null,
  dedupe_key text unique,
  message text not null,
  data jsonb not null default '{}',
  created_at timestamptz not null default now()
);
