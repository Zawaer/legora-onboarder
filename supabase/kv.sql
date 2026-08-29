-- One key-value table, so there is one database rather than two.
--
-- The stores in this repo that are not worth their own schema - an ingested
-- corpus, hire state, resolution counters - are JSON documents keyed by a
-- string. They were briefly pointed at Upstash, which meant provisioning a
-- second service for data that Postgres holds perfectly well.
--
-- Run once in the Supabase SQL editor. Idempotent.

create table if not exists public.kv (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

-- No RLS policies, and RLS stays ON, which means the anon key can read
-- nothing here. Every caller is server-side and uses the service key. If
-- anything client-side ever needs a value out of this table, it gets a policy
-- written for that key rather than a blanket one.
alter table public.kv enable row level security;
