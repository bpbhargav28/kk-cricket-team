-- ============================================================================
-- KK CRICKET TEAM — 01. Core schema
-- ----------------------------------------------------------------------------
-- Tables, constraints, indexes and the signup trigger.
-- Row Level Security lives in 20260101000100_row_level_security.sql,
-- business logic (expense splitting, payments) in 20260101000200_functions.sql.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enum-ish domains are modelled as text + CHECK so they are easy to extend
-- from the SQL editor without ALTER TYPE migrations.
-- ---------------------------------------------------------------------------

-- ===========================================================================
-- profiles — one row per authenticated team member
-- ===========================================================================
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text        not null check (length(btrim(full_name)) between 2 and 80),
  email       text,
  phone       text check (phone is null or length(btrim(phone)) between 6 and 20),
  role        text        not null default 'player' check (role in ('admin', 'player')),
  jersey_no   smallint check (jersey_no is null or jersey_no between 0 and 999),
  is_active   boolean     not null default true,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is 'Team members. `role` is the single source of truth for admin rights and is only writable by admins (enforced by trigger + RLS).';

create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists profiles_active_idx on public.profiles (is_active) where is_active;
create unique index if not exists profiles_email_key on public.profiles (lower(email)) where email is not null;

-- ===========================================================================
-- matches
-- ===========================================================================
create table if not exists public.matches (
  id                       uuid primary key default gen_random_uuid(),
  title                    text        not null check (length(btrim(title)) between 3 and 120),
  match_date               date        not null,
  match_time               time        not null,
  location                 text        not null check (length(btrim(location)) between 3 and 160),
  description              text check (description is null or length(description) <= 2000),
  total_expense            numeric(12, 2) not null default 0 check (total_expense >= 0),
  voting_deadline          timestamptz,
  status                   text        not null default 'upcoming'
                             check (status in ('upcoming', 'completed', 'cancelled')),
  voting_open              boolean     not null default true,
  contributions_finalized  boolean     not null default false,
  finalized_at             timestamptz,
  cancellation_reason      text,
  created_by               uuid references public.profiles (id) on delete set null,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

comment on column public.matches.voting_open is 'Admins close voting explicitly via close_voting(); the UI also treats a passed voting_deadline as closed.';
comment on column public.matches.contributions_finalized is 'Once true, re-splitting requires an explicit forced recalculation which is written to contribution_audit.';

create index if not exists matches_date_idx on public.matches (match_date desc, match_time desc);
create index if not exists matches_status_idx on public.matches (status);
create index if not exists matches_created_by_idx on public.matches (created_by);

-- ===========================================================================
-- match_votes — one active vote per player per match
-- ===========================================================================
create table if not exists public.match_votes (
  id         uuid primary key default gen_random_uuid(),
  match_id   uuid        not null references public.matches (id) on delete cascade,
  player_id  uuid        not null references public.profiles (id) on delete cascade,
  vote       text        not null check (vote in ('yes', 'no', 'maybe')),
  note       text check (note is null or length(note) <= 280),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint match_votes_unique_player unique (match_id, player_id)
);

comment on table public.match_votes is 'Attendance votes. The UNIQUE(match_id, player_id) constraint guarantees a single active vote per player; changing a vote is an UPDATE, not a new row.';

create index if not exists match_votes_match_idx on public.match_votes (match_id);
create index if not exists match_votes_player_idx on public.match_votes (player_id);
create index if not exists match_votes_match_vote_idx on public.match_votes (match_id, vote);

-- ===========================================================================
-- match_expenses — optional line-item breakdown behind matches.total_expense
-- ===========================================================================
create table if not exists public.match_expenses (
  id         uuid primary key default gen_random_uuid(),
  match_id   uuid        not null references public.matches (id) on delete cascade,
  label      text        not null check (length(btrim(label)) between 2 and 100),
  amount     numeric(12, 2) not null check (amount >= 0),
  category   text        not null default 'other'
               check (category in ('ground', 'ball', 'kit', 'refreshments', 'umpire', 'travel', 'other')),
  notes      text check (notes is null or length(notes) <= 500),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists match_expenses_match_idx on public.match_expenses (match_id);

-- ===========================================================================
-- player_contributions — what each confirmed player owes for a match
-- ===========================================================================
create table if not exists public.player_contributions (
  id                 uuid primary key default gen_random_uuid(),
  match_id           uuid        not null references public.matches (id) on delete cascade,
  player_id          uuid        not null references public.profiles (id) on delete cascade,
  amount_due         numeric(12, 2) not null default 0 check (amount_due >= 0),
  is_exempt          boolean     not null default false,
  is_manual_override boolean     not null default false,
  override_reason    text check (override_reason is null or length(override_reason) <= 280),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint player_contributions_unique_player unique (match_id, player_id)
);

comment on table public.player_contributions is 'Single source of truth for amount owed. Rows with is_manual_override or is_exempt are never overwritten by the automatic split.';

create index if not exists player_contributions_match_idx on public.player_contributions (match_id);
create index if not exists player_contributions_player_idx on public.player_contributions (player_id);

-- ===========================================================================
-- payments — collection tracking (no payment gateway in v1)
-- ===========================================================================
create table if not exists public.payments (
  id           uuid primary key default gen_random_uuid(),
  match_id     uuid        not null references public.matches (id) on delete cascade,
  player_id    uuid        not null references public.profiles (id) on delete cascade,
  -- Denormalised from player_contributions and kept in sync by a trigger so that
  -- `status` can be a generated column and player queries need no join.
  amount_due   numeric(12, 2) not null default 0 check (amount_due >= 0),
  amount_paid  numeric(12, 2) not null default 0 check (amount_paid >= 0),
  status       text generated always as (
                 case
                   when amount_due <= 0 then 'paid'
                   when amount_paid >= amount_due then 'paid'
                   when amount_paid > 0 then 'partially_paid'
                   else 'pending'
                 end
               ) stored,
  payment_date timestamptz,
  method       text check (method is null or method in ('cash', 'upi', 'bank_transfer', 'other')),
  notes        text check (notes is null or length(notes) <= 500),
  recorded_by  uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint payments_unique_player unique (match_id, player_id)
);

comment on column public.payments.status is 'Generated in the database so a client can never disagree with the stored amounts.';

create index if not exists payments_match_idx on public.payments (match_id);
create index if not exists payments_player_idx on public.payments (player_id);
create index if not exists payments_status_idx on public.payments (status);
create index if not exists payments_outstanding_idx on public.payments (match_id) where status <> 'paid';

-- ===========================================================================
-- contribution_audit — immutable history of expense / contribution changes
-- ===========================================================================
create table if not exists public.contribution_audit (
  id         bigserial primary key,
  match_id   uuid        not null references public.matches (id) on delete cascade,
  player_id  uuid references public.profiles (id) on delete set null,
  action     text        not null check (action in (
                'recalculated', 'manual_override', 'override_cleared', 'exempted',
                'exemption_removed', 'payment_recorded', 'expense_changed',
                'voting_closed', 'voting_reopened', 'finalized', 'match_cancelled'
              )),
  old_value  jsonb,
  new_value  jsonb,
  reason     text check (reason is null or length(reason) <= 500),
  changed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.contribution_audit is 'Append-only. Nothing in the app ever updates or deletes these rows.';

create index if not exists contribution_audit_match_idx on public.contribution_audit (match_id, created_at desc);
create index if not exists contribution_audit_player_idx on public.contribution_audit (player_id);

-- ===========================================================================
-- updated_at maintenance
-- ===========================================================================
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'matches', 'match_votes', 'match_expenses',
    'player_contributions', 'payments'
  ]
  loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.touch_updated_at()', t
    );
  end loop;
end;
$$;

-- ===========================================================================
-- Signup hook — create a profile for every new auth user
-- ===========================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  v_name := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
    split_part(new.email, '@', 1)
  );

  -- Always 'player'. Admin rights are granted deliberately via promote_to_admin()
  -- or from the Supabase SQL editor; a signup payload can never ask for them.
  insert into public.profiles (id, full_name, email, phone, role)
  values (
    new.id,
    left(v_name, 80),
    new.email,
    nullif(btrim(new.raw_user_meta_data ->> 'phone'), ''),
    'player'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ===========================================================================
-- Role-escalation guard
-- ===========================================================================
create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_admin boolean;
begin
  if new.role = old.role and new.is_active = old.is_active then
    return new;
  end if;

  -- auth.uid() is null for service-role / SQL-editor sessions, which are trusted.
  if auth.uid() is null then
    return new;
  end if;

  -- First-run bootstrap: while the team has no admin at all, promote_to_admin()
  -- is allowed to create the very first one. See promote_to_admin() for the
  -- (self-promotion only) restrictions that apply in that window.
  if not exists (select 1 from public.profiles where role = 'admin' and is_active) then
    return new;
  end if;

  select p.role = 'admin' into v_is_admin
  from public.profiles p
  where p.id = auth.uid();

  if coalesce(v_is_admin, false) then
    -- An admin may not strip their own admin rights if they are the last one left,
    -- otherwise the team would be locked out of all admin functionality.
    if old.role = 'admin' and new.role <> 'admin'
       and (select count(*) from public.profiles where role = 'admin' and is_active) <= 1 then
      raise exception 'Cannot demote the last remaining admin.'
        using errcode = 'check_violation';
    end if;
    return new;
  end if;

  raise exception 'Only an admin can change role or active status.'
    using errcode = 'insufficient_privilege';
end;
$$;

drop trigger if exists guard_profile_privileges on public.profiles;
create trigger guard_profile_privileges
  before update on public.profiles
  for each row execute function public.guard_profile_privileges();

-- ===========================================================================
-- Realtime — publish the tables the UI subscribes to
-- ===========================================================================
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.matches;
    exception when duplicate_object then null; end;
    begin
      alter publication supabase_realtime add table public.match_votes;
    exception when duplicate_object then null; end;
    begin
      alter publication supabase_realtime add table public.player_contributions;
    exception when duplicate_object then null; end;
    begin
      alter publication supabase_realtime add table public.payments;
    exception when duplicate_object then null; end;
    begin
      alter publication supabase_realtime add table public.profiles;
    exception when duplicate_object then null; end;
  end if;
end;
$$;

-- Realtime needs the full previous row to evaluate RLS on DELETE/UPDATE events.
alter table public.match_votes replica identity full;
alter table public.player_contributions replica identity full;
alter table public.payments replica identity full;
