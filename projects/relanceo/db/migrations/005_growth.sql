-- Prospects (formulaire « demander une démo ») : réservé au serveur et à l'administrateur de RELANCEO.
create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 120),
  company text check (length(company) <= 200),
  email text not null check (length(email) <= 254),
  phone text check (length(phone) <= 40),
  message text check (length(message) <= 2000),
  team_size text check (length(team_size) <= 40),
  status text not null default 'new' check (status in ('new', 'contacted', 'won', 'lost')),
  created_at timestamptz not null default app.now()
);
alter table leads enable row level security;
alter table leads force row level security;
grant all on leads to service_role;
revoke all on leads from public;
