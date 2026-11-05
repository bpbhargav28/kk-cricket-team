-- ============================================================================
-- KK CRICKET TEAM — 02. Row Level Security
-- ----------------------------------------------------------------------------
-- Every table is RLS-protected and nothing is readable by `anon`.
-- Admin rights are resolved server-side from public.profiles.role; the client's
-- own claim about its role is never trusted.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Helpers. SECURITY DEFINER so they can read profiles without tripping the
-- policies that are themselves defined in terms of these helpers.
-- ---------------------------------------------------------------------------
create or replace function public.is_admin(p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = p_user and role = 'admin' and is_active
  );
$$;

create or replace function public.is_team_member(p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = p_user and is_active
  );
$$;

create or replace function public.match_voting_is_open(p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.matches m
    where m.id = p_match_id
      and m.voting_open
      and m.status = 'upcoming'
      and (m.voting_deadline is null or m.voting_deadline > now())
  );
$$;

revoke all on function public.is_admin(uuid) from public;
revoke all on function public.is_team_member(uuid) from public;
revoke all on function public.match_voting_is_open(uuid) from public;
grant execute on function public.is_admin(uuid) to authenticated;
grant execute on function public.is_team_member(uuid) to authenticated;
grant execute on function public.match_voting_is_open(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------
alter table public.profiles             enable row level security;
alter table public.matches              enable row level security;
alter table public.match_votes          enable row level security;
alter table public.match_expenses       enable row level security;
alter table public.player_contributions enable row level security;
alter table public.payments             enable row level security;
alter table public.contribution_audit   enable row level security;

-- NOTE: FORCE ROW LEVEL SECURITY is deliberately *not* used. The privileged
-- helpers in 20260101000200_functions.sql are SECURITY DEFINER and run as the
-- table owner; forcing RLS on the owner would block the audit-trail inserts
-- (contribution_audit intentionally has no INSERT policy for clients).
-- The Supabase API never connects as the owner role.

-- ===========================================================================
-- profiles
-- ===========================================================================
drop policy if exists "profiles_select_team" on public.profiles;
create policy "profiles_select_team" on public.profiles
  for select to authenticated
  using (true);  -- the roster is team-visible; no payment data lives here

drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self" on public.profiles
  for insert to authenticated
  with check (id = auth.uid() and role = 'player');

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());
  -- role / is_active changes are additionally blocked by guard_profile_privileges()

drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin" on public.profiles
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "profiles_delete_admin" on public.profiles;
create policy "profiles_delete_admin" on public.profiles
  for delete to authenticated
  using (public.is_admin() and id <> auth.uid());

-- ===========================================================================
-- matches — readable by the whole team, writable only by admins
-- ===========================================================================
drop policy if exists "matches_select_team" on public.matches;
create policy "matches_select_team" on public.matches
  for select to authenticated
  using (public.is_team_member());

drop policy if exists "matches_insert_admin" on public.matches;
create policy "matches_insert_admin" on public.matches
  for insert to authenticated
  with check (public.is_admin() and created_by = auth.uid());

drop policy if exists "matches_update_admin" on public.matches;
create policy "matches_update_admin" on public.matches
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "matches_delete_admin" on public.matches;
create policy "matches_delete_admin" on public.matches
  for delete to authenticated
  using (public.is_admin());

-- ===========================================================================
-- match_votes — a player may only ever touch their own vote
-- ===========================================================================
drop policy if exists "votes_select_team" on public.match_votes;
create policy "votes_select_team" on public.match_votes
  for select to authenticated
  using (public.is_team_member());

drop policy if exists "votes_insert_self" on public.match_votes;
create policy "votes_insert_self" on public.match_votes
  for insert to authenticated
  with check (
    player_id = auth.uid()
    and public.is_team_member()
    and public.match_voting_is_open(match_id)
  );

drop policy if exists "votes_update_self" on public.match_votes;
create policy "votes_update_self" on public.match_votes
  for update to authenticated
  using (player_id = auth.uid() and public.match_voting_is_open(match_id))
  with check (player_id = auth.uid() and public.match_voting_is_open(match_id));

drop policy if exists "votes_delete_self" on public.match_votes;
create policy "votes_delete_self" on public.match_votes
  for delete to authenticated
  using (player_id = auth.uid() and public.match_voting_is_open(match_id));

-- Admins may correct votes on behalf of players (e.g. somebody texted them).
drop policy if exists "votes_admin_all" on public.match_votes;
create policy "votes_admin_all" on public.match_votes
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ===========================================================================
-- match_expenses
-- ===========================================================================
drop policy if exists "expenses_select_team" on public.match_expenses;
create policy "expenses_select_team" on public.match_expenses
  for select to authenticated
  using (public.is_team_member());

drop policy if exists "expenses_admin_all" on public.match_expenses;
create policy "expenses_admin_all" on public.match_expenses
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ===========================================================================
-- player_contributions — team-visible (the split must be auditable by all),
-- writable only by admins / the SECURITY DEFINER split functions.
-- ===========================================================================
drop policy if exists "contributions_select_team" on public.player_contributions;
create policy "contributions_select_team" on public.player_contributions
  for select to authenticated
  using (public.is_team_member());

drop policy if exists "contributions_admin_all" on public.player_contributions;
create policy "contributions_admin_all" on public.player_contributions
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ===========================================================================
-- payments — a player sees ONLY their own row. Team-wide totals are exposed
-- through the aggregate-only match_payment_summary view.
-- ===========================================================================
drop policy if exists "payments_select_own" on public.payments;
create policy "payments_select_own" on public.payments
  for select to authenticated
  using (player_id = auth.uid() or public.is_admin());

drop policy if exists "payments_admin_all" on public.payments;
create policy "payments_admin_all" on public.payments
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
  -- NOTE: there is deliberately no INSERT/UPDATE policy for players.
  -- Players can never mark themselves as paid.

-- ===========================================================================
-- contribution_audit — append-only; written by SECURITY DEFINER functions.
-- ===========================================================================
drop policy if exists "audit_select_admin_or_own" on public.contribution_audit;
create policy "audit_select_admin_or_own" on public.contribution_audit
  for select to authenticated
  using (public.is_admin() or player_id = auth.uid());
  -- No INSERT/UPDATE/DELETE policies: clients cannot forge or erase history.

-- ===========================================================================
-- Aggregate views — safe team-wide summaries that do not leak who owes what.
-- ===========================================================================
drop view if exists public.match_payment_summary;
create view public.match_payment_summary as
select
  m.id                                                           as match_id,
  m.title,
  m.match_date,
  m.total_expense,
  coalesce(sum(p.amount_due), 0)::numeric(12, 2)                 as total_due,
  coalesce(sum(p.amount_paid), 0)::numeric(12, 2)                as total_collected,
  greatest(coalesce(sum(p.amount_due - p.amount_paid), 0), 0)::numeric(12, 2) as outstanding,
  count(p.id)                                                    as contributors,
  count(p.id) filter (where p.status = 'paid')                   as paid_count,
  count(p.id) filter (where p.status = 'partially_paid')          as partially_paid_count,
  count(p.id) filter (where p.status = 'pending')                 as pending_count
from public.matches m
left join public.payments p on p.match_id = m.id
group by m.id, m.title, m.match_date, m.total_expense;

comment on view public.match_payment_summary is 'Aggregate-only payment totals per match. Readable by the whole team; exposes no per-player amounts.';

drop view if exists public.match_vote_summary;
create view public.match_vote_summary as
select
  m.id                                                as match_id,
  count(v.id) filter (where v.vote = 'yes')           as yes_count,
  count(v.id) filter (where v.vote = 'no')            as no_count,
  count(v.id) filter (where v.vote = 'maybe')         as maybe_count,
  count(v.id)                                         as total_votes,
  (select count(*) from public.profiles where is_active) as active_players
from public.matches m
left join public.match_votes v on v.match_id = m.id
group by m.id;

revoke all on public.match_payment_summary from anon, authenticated;
revoke all on public.match_vote_summary from anon, authenticated;
grant select on public.match_payment_summary to authenticated;
grant select on public.match_vote_summary to authenticated;

-- ---------------------------------------------------------------------------
-- Nothing is reachable without a session.
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
