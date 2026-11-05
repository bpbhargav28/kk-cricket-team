-- ============================================================================
-- KK CRICKET TEAM — Deployment verification
-- ----------------------------------------------------------------------------
-- This script is designed to be pasted into the Supabase SQL editor to verify
-- a deployment. It is read-only and non-destructive — no rows are created or
-- deleted. All assertions raise an exception on failure.
-- ============================================================================

-- ===========================================================================
-- Check that all expected tables exist and have RLS enabled
-- ===========================================================================
do $$
declare
  t text;
  v_rls boolean;
begin
  foreach t in array array[
    'profiles', 'matches', 'match_votes', 'match_expenses',
    'player_contributions', 'payments', 'contribution_audit'
  ]
  loop
    -- Check table exists and RLS is enabled
    select relrowsecurity into v_rls
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where c.relname = t and n.nspname = 'public' and c.relkind = 'r';

    if not found then
      raise exception 'Table public.% does not exist', t;
    end if;

    if not v_rls then
      raise exception 'Table public.% does not have row level security enabled', t;
    end if;
  end loop;
end;
$$;

-- ===========================================================================
-- Check that payments.status is a generated column
-- ===========================================================================
do $$
declare
  v_generated char;
begin
  select a.attgenerated into v_generated
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  where c.relname = 'payments'
    and n.nspname = 'public'
    and a.attname = 'status';

  if not found then
    raise exception 'payments.status column does not exist';
  end if;

  if v_generated <> 's' then
    raise exception 'payments.status is not a generated column (expected attgenerated = ''s'', got ''%'')', v_generated;
  end if;
end;
$$;

-- ===========================================================================
-- Check unique constraints on (match_id, player_id)
-- ===========================================================================
do $$
declare
  v_exists boolean;
begin
  -- match_votes unique constraint
  select exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where t.relname = 'match_votes'
      and n.nspname = 'public'
      and c.contype = 'u'
      and c.conname = 'match_votes_unique_player'
  ) into v_exists;

  if not v_exists then
    raise exception 'match_votes does not have unique constraint match_votes_unique_player on (match_id, player_id)';
  end if;

  -- player_contributions unique constraint
  select exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where t.relname = 'player_contributions'
      and n.nspname = 'public'
      and c.contype = 'u'
      and c.conname = 'player_contributions_unique_player'
  ) into v_exists;

  if not v_exists then
    raise exception 'player_contributions does not have unique constraint player_contributions_unique_player on (match_id, player_id)';
  end if;

  -- payments unique constraint
  select exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where t.relname = 'payments'
      and n.nspname = 'public'
      and c.contype = 'u'
      and c.conname = 'payments_unique_player'
  ) into v_exists;

  if not v_exists then
    raise exception 'payments does not have unique constraint payments_unique_player on (match_id, player_id)';
  end if;
end;
$$;

-- ===========================================================================
-- Check that contribution_audit has NO insert/update/delete policies
-- (append-only via SECURITY DEFINER only)
-- ===========================================================================
do $$
declare
  v_count int;
begin
  select count(*) into v_count
  from pg_policies
  where schemaname = 'public'
    and tablename = 'contribution_audit'
    and cmd in ('INSERT', 'UPDATE', 'DELETE');

  if v_count > 0 then
    raise exception 'contribution_audit has % INSERT/UPDATE/DELETE policies (expected 0 — append-only via SECURITY DEFINER)', v_count;
  end if;
end;
$$;

-- ===========================================================================
-- Check that expected RLS policies exist
-- ===========================================================================
do $$
declare
  v_exists boolean;
begin
  -- profiles
  select exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_select_team'
  ) into v_exists;
  if not v_exists then
    raise exception 'Missing policy: profiles_select_team';
  end if;

  -- matches
  select exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'matches' and policyname = 'matches_select_team'
  ) into v_exists;
  if not v_exists then
    raise exception 'Missing policy: matches_select_team';
  end if;

  select exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'matches' and policyname = 'matches_insert_admin'
  ) into v_exists;
  if not v_exists then
    raise exception 'Missing policy: matches_insert_admin';
  end if;

  -- match_votes
  select exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'match_votes' and policyname = 'votes_select_team'
  ) into v_exists;
  if not v_exists then
    raise exception 'Missing policy: votes_select_team';
  end if;

  select exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'match_votes' and policyname = 'votes_insert_self'
  ) into v_exists;
  if not v_exists then
    raise exception 'Missing policy: votes_insert_self';
  end if;

  -- player_contributions
  select exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'player_contributions' and policyname = 'contributions_select_team'
  ) into v_exists;
  if not v_exists then
    raise exception 'Missing policy: contributions_select_team';
  end if;

  -- payments
  select exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'payments' and policyname = 'payments_select_own'
  ) into v_exists;
  if not v_exists then
    raise exception 'Missing policy: payments_select_own';
  end if;

  -- contribution_audit
  select exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'contribution_audit' and policyname = 'audit_select_admin_or_own'
  ) into v_exists;
  if not v_exists then
    raise exception 'Missing policy: audit_select_admin_or_own';
  end if;
end;
$$;

-- ===========================================================================
-- Check that helper functions exist and are SECURITY DEFINER
-- ===========================================================================
do $$
declare
  fn record;
  v_security text;
begin
  for fn in
    select 'is_admin'::text as name, 'uuid'::text as args union all
    select 'is_team_member', 'uuid' union all
    select 'match_voting_is_open', 'uuid'
  loop
    select prosecdef::text into v_security
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = fn.name;

    if not found then
      raise exception 'Helper function public.%(%%) does not exist', fn.name, fn.args;
    end if;

    if v_security <> 'true' then
      raise exception 'Helper function public.%(%%) is not SECURITY DEFINER', fn.name, fn.args;
    end if;
  end loop;
end;
$$;

-- ===========================================================================
-- Check that RPC functions exist and are SECURITY DEFINER
-- ===========================================================================
do $$
declare
  fn text;
  v_security text;
begin
  foreach fn in array array[
    'recalculate_match_contributions',
    'set_manual_contribution',
    'clear_manual_contribution',
    'set_player_exemption',
    'close_voting',
    'reopen_voting',
    'record_payment',
    'mark_payment_paid',
    'promote_to_admin',
    'get_dashboard_summary',
    'assert_admin'
  ]
  loop
    select prosecdef::text into v_security
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = fn;

    if not found then
      raise exception 'RPC function public.%% does not exist', fn;
    end if;

    if v_security <> 'true' then
      raise exception 'RPC function public.%% is not SECURITY DEFINER', fn;
    end if;
  end loop;
end;
$$;

-- ===========================================================================
-- Check that anon and public roles have no execute on helper/RPC functions
-- ===========================================================================
do $$
declare
  fn text;
  v_has_public_grant boolean;
  v_has_anon_grant boolean;
begin
  foreach fn in array array[
    'is_admin',
    'is_team_member',
    'match_voting_is_open',
    'recalculate_match_contributions',
    'set_manual_contribution',
    'clear_manual_contribution',
    'set_player_exemption',
    'close_voting',
    'reopen_voting',
    'record_payment',
    'mark_payment_paid',
    'promote_to_admin',
    'get_dashboard_summary',
    'assert_admin'
  ]
  loop
    select
      exists (
        select 1 from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = fn
          and has_function_privilege('public', p.oid, 'execute')
      ),
      exists (
        select 1 from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = fn
          and has_function_privilege('anon', p.oid, 'execute')
      )
    into v_has_public_grant, v_has_anon_grant;

    if v_has_public_grant then
      raise exception 'Function public.%% has EXECUTE granted to public role (should be revoked)', fn;
    end if;

    if v_has_anon_grant then
      raise exception 'Function public.%% has EXECUTE granted to anon role (should be revoked)', fn;
    end if;
  end loop;
end;
$$;

-- ===========================================================================
-- Check that views exist
-- ===========================================================================
do $$
declare
  v text;
  v_exists boolean;
begin
  foreach v in array array['match_payment_summary', 'match_vote_summary']
  loop
    select exists (
      select 1 from pg_views where schemaname = 'public' and viewname = v
    ) into v_exists;

    if not v_exists then
      raise exception 'View public.%% does not exist', v;
    end if;
  end loop;
end;
$$;

-- ===========================================================================
-- Check recalculate_match_contributions signature
-- (non-destructive: we only verify the function exists with the right args)
-- ===========================================================================
do $$
declare
  v_exists boolean;
begin
  select exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'recalculate_match_contributions'
      and p.prorettype = 'jsonb'::regtype::oid
  ) into v_exists;

  if not v_exists then
    raise exception 'recalculate_match_contributions does not exist or does not return jsonb';
  end if;
end;
$$;

-- ===========================================================================
-- All checks passed
-- ===========================================================================
raise notice 'Deployment verification passed. All tables, policies, constraints, and functions are in place.';
