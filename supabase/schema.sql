-- Run once in Supabase: SQL Editor > New query > paste > Run
create table if not exists profiles (
  id uuid primary key,              -- = auth.users.id
  email text not null,
  name text,
  role text not null default 'creator' check (role in ('creator','manager','reviewer','admin')),
  created_at timestamptz not null default now()
);
create table if not exists rulebooks (
  id text primary key default 'default',
  rules text not null,
  facts text not null default '',
  updated_at timestamptz not null default now()
);
create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  title text,
  content text not null,
  findings jsonb not null default '[]',
  dismissed jsonb not null default '[]',
  stage int not null default 0 check (stage between 0 and 3),
  author_id uuid,
  author_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists audit_log (
  id bigint generated always as identity primary key,
  review_id uuid references reviews(id) on delete cascade,
  user_email text,
  role text,
  action text not null,
  created_at timestamptz not null default now()
);
-- RLS on with no public policies: all access goes through the server (service-role key).
alter table profiles enable row level security;
alter table rulebooks enable row level security;
alter table reviews enable row level security;
alter table audit_log enable row level security;
