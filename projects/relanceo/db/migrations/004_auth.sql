-- Authentification : mots de passe (scrypt, jamais en clair), réinitialisation, anti force brute.
-- Tables réservées au serveur (service_role) : aucune politique pour "authenticated".
create table if not exists user_credentials (
  user_id uuid primary key references users(id) on delete cascade,
  password_hash text not null,
  updated_at timestamptz not null default now()
);

create table if not exists password_resets (
  token_hash text primary key,
  user_id uuid not null references users(id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default app.now()
);

create table if not exists auth_throttle (
  key text not null,
  window_start timestamptz not null,
  attempts integer not null default 0,
  primary key (key, window_start)
);

alter table users add column if not exists terms_accepted_at timestamptz;
alter table users add column if not exists terms_version text;
alter table users add column if not exists last_login_at timestamptz;

alter table user_credentials enable row level security;
alter table user_credentials force row level security;
alter table password_resets enable row level security;
alter table password_resets force row level security;
alter table auth_throttle enable row level security;
alter table auth_throttle force row level security;
grant all on user_credentials, password_resets, auth_throttle to service_role;
revoke all on user_credentials, password_resets, auth_throttle from public;
