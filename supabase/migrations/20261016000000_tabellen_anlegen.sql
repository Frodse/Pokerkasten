-- Grundtabellen für den Multiplayer (siehe docs/architektur.md).
-- Handys lesen nur, geschrieben wird ausschließlich über Edge Functions.

create table sessions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[0-9]{4}$'),  -- 4-stelliger Beitrittscode
  status text not null default 'lobby' check (status in ('lobby','playing','over')),
  state jsonb not null default '{}',                      -- kompletter Spielzustand
  current_player_id uuid,
  created_at timestamptz not null default now()
);

create table players (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  name text not null,
  chips integer not null default 0,
  seat integer not null,
  is_host boolean not null default false,
  last_seen timestamptz not null default now(),
  unique (session_id, seat)
);

create table actions (                                    -- Protokoll, Basis für Undo
  id bigint generated always as identity primary key,
  session_id uuid not null references sessions(id) on delete cascade,
  player_id uuid references players(id) on delete set null,
  type text not null,
  amount integer,
  created_at timestamptz not null default now()
);

create table player_secrets (                             -- nur für Edge Functions
  player_id uuid primary key references players(id) on delete cascade,
  token_hash text not null
);

alter table sessions enable row level security;
alter table players enable row level security;
alter table actions enable row level security;
alter table player_secrets enable row level security;     -- ohne Regel: für Handys unsichtbar
create policy "lesen" on sessions for select using (true);
create policy "lesen" on players for select using (true);
create policy "lesen" on actions for select using (true);

alter publication supabase_realtime add table sessions, players;
