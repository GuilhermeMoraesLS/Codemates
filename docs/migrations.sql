-- ============================================================
-- Codemates V1 — Supabase Migrations
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ── USERS ────────────────────────────────────────────────────
create table if not exists users (
  id            uuid primary key default uuid_generate_v4(),
  github_id     bigint unique not null,
  username      text unique not null,
  avatar        text,
  streak_atual  int not null default 0,
  streak_shield int not null default 1,        -- shields disponíveis (1/mês)
  pontos_total  int not null default 0,
  nivel         text not null default 'INICIANTE', -- INICIANTE | DEV | ENGENHEIRO | SÊNIOR | ARQUITETO
  missoes_concluidas int not null default 0,
  plano         text not null default 'free',  -- free | pro (futuro)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ── GITHUB PROFILES ──────────────────────────────────────────
create table if not exists github_profiles (
  user_id             uuid primary key references users(id) on delete cascade,
  linguagens_json     jsonb,   -- { "TypeScript": 68, "Python": 22, ... }
  repos_publicos      int default 0,
  frequencia_commits  text,    -- "alta" | "media" | "baixa"
  ultimo_scan         timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ── GROUPS ───────────────────────────────────────────────────
create table if not exists groups (
  id              uuid primary key default uuid_generate_v4(),
  nome            text not null,
  stack_alvo      text not null,
  objetivo        text,
  owner_id        uuid not null references users(id) on delete restrict,
  streak_coletivo int not null default 0,
  max_membros     int not null default 5 check (max_membros between 3 and 7),
  created_at      timestamptz not null default now()
);

-- ── GROUP MEMBERS ─────────────────────────────────────────────
create table if not exists group_members (
  user_id           uuid not null references users(id) on delete cascade,
  group_id          uuid not null references groups(id) on delete cascade,
  missoes_concluidas int not null default 0,
  pontos_grupo      int not null default 0,
  joined_at         timestamptz not null default now(),
  primary key (user_id, group_id)
);

-- ── INVITES ──────────────────────────────────────────────────
create table if not exists invites (
  id         uuid primary key default uuid_generate_v4(),
  group_id   uuid not null references groups(id) on delete cascade,
  criado_por uuid not null references users(id) on delete cascade,
  token      text unique not null,
  usado      boolean not null default false,
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now()
);

-- ── MISSIONS ─────────────────────────────────────────────────
create table if not exists missions (
  id          uuid primary key default uuid_generate_v4(),
  group_id    uuid not null references groups(id) on delete cascade,
  user_id     uuid references users(id) on delete cascade, -- null = missão coletiva
  tipo        text not null default 'individual',           -- individual | coletiva
  descricao   text not null,
  criterios   jsonb,   -- { "keywords": [...], "min_files": 1, "languages": [...] }
  pontos      int not null default 100,
  semana_ref  text not null,  -- formato ISO: "2025-W12"
  status      text not null default 'ativa',  -- ativa | encerrada
  created_at  timestamptz not null default now()
);

-- ── DELIVERIES ───────────────────────────────────────────────
create table if not exists deliveries (
  id            uuid primary key default uuid_generate_v4(),
  mission_id    uuid not null references missions(id) on delete cascade,
  user_id       uuid not null references users(id) on delete cascade,
  commit_url    text not null,
  commit_sha    text not null,
  repo_name     text not null,
  pontos_ganhos int not null default 0,   -- % dos pontos da missão
  verificado_em timestamptz not null default now(),
  unique (mission_id, user_id, commit_sha)
);

-- ── STREAK EVENTS ────────────────────────────────────────────
create table if not exists streak_events (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references users(id) on delete cascade,
  semana_ref text not null,    -- "2025-W12"
  tipo       text not null,    -- "mantido" | "quebrado" | "shield_usado"
  created_at timestamptz not null default now(),
  unique (user_id, semana_ref)
);

-- ============================================================
-- INDEXES
-- ============================================================
create index if not exists idx_group_members_group on group_members(group_id);
create index if not exists idx_missions_group_semana on missions(group_id, semana_ref);
create index if not exists idx_deliveries_mission on deliveries(mission_id);
create index if not exists idx_deliveries_user on deliveries(user_id);
create index if not exists idx_invites_token on invites(token);
create index if not exists idx_streak_events_user on streak_events(user_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table users enable row level security;
alter table github_profiles enable row level security;
alter table groups enable row level security;
alter table group_members enable row level security;
alter table missions enable row level security;
alter table deliveries enable row level security;
alter table invites enable row level security;
alter table streak_events enable row level security;

-- users: leitura pública, escrita só próprio usuário (via service role no backend)
create policy "users_public_read" on users for select using (true);
create policy "users_service_write" on users for all using (auth.role() = 'service_role');

-- github_profiles: leitura pública
create policy "profiles_public_read" on github_profiles for select using (true);
create policy "profiles_service_write" on github_profiles for all using (auth.role() = 'service_role');

-- groups: leitura pública, escrita via service role
create policy "groups_public_read" on groups for select using (true);
create policy "groups_service_write" on groups for all using (auth.role() = 'service_role');

-- group_members: leitura pública
create policy "members_public_read" on group_members for select using (true);
create policy "members_service_write" on group_members for all using (auth.role() = 'service_role');

-- missions: leitura pública
create policy "missions_public_read" on missions for select using (true);
create policy "missions_service_write" on missions for all using (auth.role() = 'service_role');

-- deliveries: leitura pública
create policy "deliveries_public_read" on deliveries for select using (true);
create policy "deliveries_service_write" on deliveries for all using (auth.role() = 'service_role');

-- invites: só via service role
create policy "invites_service_all" on invites for all using (auth.role() = 'service_role');

-- streak_events: leitura pública
create policy "streak_public_read" on streak_events for select using (true);
create policy "streak_service_write" on streak_events for all using (auth.role() = 'service_role');

-- ============================================================
-- MIGRATION v2 — github_profiles: novos campos de análise
-- ============================================================
alter table github_profiles
  add column if not exists frameworks_json jsonb default '[]'::jsonb,
  add column if not exists nivel_mercado   text  default '';

-- ============================================================
-- MIGRATION v3 — github_profiles: campos de análise narrativa
-- ============================================================
alter table github_profiles
  add column if not exists especialidade_detectada text  default '',
  add column if not exists areas_a_fortalecer      jsonb default '[]'::jsonb,
  add column if not exists missao_sugerida         text  default '';

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Atualiza updated_at automaticamente
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_users_updated_at
  before update on users
  for each row execute function update_updated_at();

create trigger trg_github_profiles_updated_at
  before update on github_profiles
  for each row execute function update_updated_at();

-- Calcula nível baseado em missões concluídas
create or replace function calcular_nivel(missoes int)
returns text as $$
begin
  return case
    when missoes >= 50 then 'ARQUITETO'
    when missoes >= 25 then 'SÊNIOR'
    when missoes >= 10 then 'ENGENHEIRO'
    when missoes >= 3  then 'DEV'
    else 'INICIANTE'
  end;
end;
$$ language plpgsql;

