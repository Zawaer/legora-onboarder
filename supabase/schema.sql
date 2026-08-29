-- VANAV — schema.
--
-- Run this once in the Supabase SQL editor (Dashboard → SQL Editor → New query
-- → paste → Run). It is idempotent: safe to run again after an edit.
--
-- The shape follows the thing two customers actually asked for on the day they
-- signed. Jussi (Apukuski): "It connects to Slack, to our Apukuski AI Brain and
-- GDPR compliant". Satu (Fermion, VP Quality): "functionality, data security
-- and fit with our onboarding needs". Both named control and governance before
-- they named features, so membership and approval are in the first schema
-- rather than bolted on after.

-- ─────────────────────────────────────────────────────────── companies
create table if not exists public.companies (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  -- When false, every draft waits for an admin before it reaches a new hire.
  -- Defaults to false on purpose: a regulated buyer must opt IN to automation,
  -- never discover they were opted in.
  auto_send   boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────── membership
do $$ begin
  create type public.member_role as enum ('admin', 'employee');
exception when duplicate_object then null;
end $$;

create table if not exists public.members (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  -- Supabase Auth owns identity; this table owns what they may do.
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        public.member_role not null default 'employee',
  full_name   text,
  created_at  timestamptz not null default now(),
  unique (company_id, user_id)
);

create index if not exists members_user_idx on public.members(user_id);
create index if not exists members_company_idx on public.members(company_id);

-- ─────────────────────────────────────────────────────────── drafts
-- What the agent wants to send, held until a human at the customer says yes.
do $$ begin
  create type public.draft_status as enum ('pending', 'approved', 'rejected', 'sent');
exception when duplicate_object then null;
end $$;

create table if not exists public.drafts (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  -- The hire this is for. Free text rather than a foreign key because a hire
  -- may exist in Slack before they exist as a member here.
  hire_ref     text not null,
  kind         text not null,
  body         text not null,
  status       public.draft_status not null default 'pending',
  -- Kept for the audit trail a quality function will ask for: who released
  -- this, and when. Nulls until somebody acts.
  decided_by   uuid references auth.users(id),
  decided_at   timestamptz,
  -- Admins may edit before approving; the original is never overwritten, so
  -- "what did the agent actually say" stays answerable.
  edited_body  text,
  created_at   timestamptz not null default now()
);

create index if not exists drafts_company_status_idx
  on public.drafts(company_id, status, created_at desc);

-- ─────────────────────────────────────────────────────────── materials
-- Onboarding docs, role descriptions, anything a company drags in. The file
-- itself lives in Storage; this row is the record of it.
create table if not exists public.materials (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  file_name   text not null,
  storage_path text not null,
  bytes       bigint,
  uploaded_by uuid references auth.users(id),
  created_at  timestamptz not null default now()
);

create index if not exists materials_company_idx on public.materials(company_id);

-- ─────────────────────────────────────────────────────── row level security
-- On for every table. A customer's onboarding material and the drafts written
-- about their staff are the two things they were most worried about handing
-- over; the database should enforce that, not the application layer.
alter table public.companies  enable row level security;
alter table public.members    enable row level security;
alter table public.drafts     enable row level security;
alter table public.materials  enable row level security;

-- Membership is the whole access rule: you see a company's rows if you belong
-- to it. Defined as a function so the policies below stay one line each and
-- cannot drift apart.
create or replace function public.is_member(target uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.members m
    where m.company_id = target and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_admin(target uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.members m
    where m.company_id = target and m.user_id = auth.uid() and m.role = 'admin'
  );
$$;

drop policy if exists companies_read on public.companies;
create policy companies_read on public.companies
  for select using (public.is_member(id));

drop policy if exists companies_admin_write on public.companies;
create policy companies_admin_write on public.companies
  for update using (public.is_admin(id));

drop policy if exists members_read on public.members;
create policy members_read on public.members
  for select using (public.is_member(company_id));

drop policy if exists members_admin_write on public.members;
create policy members_admin_write on public.members
  for all using (public.is_admin(company_id));

-- Employees never read the queue. A draft is a decision being taken about
-- them, and showing them the pending version would leak an approval that has
-- not happened yet.
drop policy if exists drafts_admin_read on public.drafts;
create policy drafts_admin_read on public.drafts
  for select using (public.is_admin(company_id));

drop policy if exists drafts_admin_write on public.drafts;
create policy drafts_admin_write on public.drafts
  for all using (public.is_admin(company_id));

drop policy if exists materials_read on public.materials;
create policy materials_read on public.materials
  for select using (public.is_member(company_id));

drop policy if exists materials_admin_write on public.materials;
create policy materials_admin_write on public.materials
  for all using (public.is_admin(company_id));
