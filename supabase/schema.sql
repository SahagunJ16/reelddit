-- Reddit Reels — database schema (Supabase / Postgres)
-- Run this in the Supabase SQL editor, or via `supabase db push`.
--
-- Intentionally minimal: the only persisted data is auth tokens (encrypted at
-- rest by the app before insert) plus optional cross-device preferences.

create extension if not exists "pgcrypto";

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  reddit_id text unique not null,
  username text not null,
  avatar_url text,
  access_token text not null,        -- encrypted at rest (AES-256-GCM)
  refresh_token text not null,       -- encrypted at rest (AES-256-GCM)
  token_expires_at timestamptz not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists users_reddit_id_idx on users (reddit_id);

-- Optional: persist sort / NSFW prefs across devices instead of localStorage.
create table if not exists user_preferences (
  user_id uuid references users(id) on delete cascade primary key,
  default_sort text default 'hot',     -- hot | new | top | rising
  top_time_range text default 'day',   -- hour | day | week | month | year | all
  nsfw_enabled boolean default false,
  updated_at timestamptz default now()
);

-- These tables are only ever touched by the server using the service-role key,
-- so Row Level Security is enabled with no public policies (deny-by-default).
alter table users enable row level security;
alter table user_preferences enable row level security;
