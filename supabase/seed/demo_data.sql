-- ===========================================================================
--  KK Cricket Team — DEMO / DEVELOPMENT SEED DATA
-- ===========================================================================
--
--  ⚠  DEVELOPMENT ONLY. Never run this against a production project.
--
--  This script is deliberately NOT part of supabase/migrations, so it never
--  runs automatically. It is guarded three ways:
--
--    1. It refuses to run unless you explicitly opt in (see KK_DEMO below).
--    2. It only touches rows it created itself, tagged with the
--       '[demo]' marker, so a later cleanup can remove them precisely.
--    3. It creates NO auth users. Supabase auth users must be created through
--       the Auth API/dashboard; this script seeds matches, votes, expenses and
--       payments for players that *already exist* in public.profiles.
--
--  USAGE
--  -----
--  1. Sign up 3+ real accounts in your local/dev project (the app signup
--     screen is fine), and promote one of them to admin — see README.
--  2. Open the Supabase SQL editor for your DEVELOPMENT project.
--  3. Run:
--         set local "kk.demo" = 'yes-i-am-on-a-dev-project';
--     …in the same statement batch as this file, or simply uncomment the
--     `set` line immediately below, then run the whole file.
--  4. To remove everything again, run supabase/seed/demo_cleanup.sql.
--
--  The frontend's matching guard is the DEMO_MODE constant in
--  src/lib/constants.ts, which is only ever true for a local `npm run dev`
--  build with VITE_ENABLE_DEMO_DATA=true. Production builds ignore it.
-- ===========================================================================

-- Uncomment this line to opt in:
-- set local "kk.demo" = 'yes-i-am-on-a-dev-project';

do $$
declare
  v_optin      text  := current_setting('kk.demo', true);
  v_admin      uuid;
  v_players    uuid[];
  v_count      int;
  v_match_past uuid;
  v_match_next uuid;
  v_match_soon uuid;
  v_player     uuid;
  v_i          int;
begin
  -- ---------------------------------------------------------------- guard 1
  if v_optin is distinct from 'yes-i-am-on-a-dev-project' then
    raise exception
      'Demo seed refused. This script is for development projects only. Set "kk.demo" to opt in — see the header of this file.';
  end if;

  -- ---------------------------------------------------------------- guard 2
  -- Require at least a few real profiles to attach the demo data to.
  select array_agg(id order by created_at), count(*)
    into v_players, v_count
    from public.profiles
   where is_active;

  if coalesce(v_count, 0) < 3 then
    raise exception
      'Demo seed needs at least 3 active profiles (found %). Sign up a few accounts first, then re-run.', coalesce(v_count, 0);
  end if;

  select id into v_admin from public.profiles where role = 'admin' and is_active limit 1;
  if v_admin is null then
    raise exception
      'Demo seed needs one admin profile. Promote an account first — see "Create the first admin" in README.md.';
  end if;

  raise notice 'Seeding demo data for % active players (admin: %)', v_count, v_admin;

  -- =========================================================== past match
  insert into public.matches (
    title, match_date, match_time, location, description,
    total_expense, voting_deadline, status, voting_open,
    contributions_finalized, finalized_at, created_by
  ) values (
    '[demo] Sunday League — Round 4',
    current_date - interval '7 days',
    '07:30',
    'Bangalore Cricket Ground, Koramangala',
    'Demo data. 20 overs a side. Ground booked for two hours.',
    3000.00,
    (current_date - interval '8 days')::timestamptz,
    'completed',
    false,
    true,
    now() - interval '7 days',
    v_admin
  )
  returning id into v_match_past;

  insert into public.match_expenses (match_id, label, amount, category, notes, created_by)
  values
    (v_match_past, '[demo] Ground booking', 2000.00, 'ground', 'Two hours, paid in advance', v_admin),
    (v_match_past, '[demo] New match balls', 700.00,  'ball',   '2 balls',                   v_admin),
    (v_match_past, '[demo] Water and snacks', 300.00, 'refreshments', null,                  v_admin);

  -- Everyone said yes to the match that already happened.
  foreach v_player in array v_players loop
    insert into public.match_votes (match_id, player_id, vote)
    values (v_match_past, v_player, 'yes')
    on conflict (match_id, player_id) do nothing;
  end loop;

  -- Split it, then collect most (but not all) of the money so the UI shows
  -- a realistic mix of paid / partially paid / pending.
  perform public.recalculate_match_contributions(
    v_match_past, true, '[demo] seeded split'
  );

  v_i := 0;
  foreach v_player in array v_players loop
    v_i := v_i + 1;
    if v_i % 4 = 0 then
      -- leave every 4th player pending
      null;
    elsif v_i % 4 = 3 then
      -- part payment
      perform public.record_payment(
        v_match_past, v_player,
        round((select amount_due from public.player_contributions
                where match_id = v_match_past and player_id = v_player) / 2, 2),
        'upi', '[demo] part payment'
      );
    else
      perform public.mark_payment_paid(v_match_past, v_player, 'cash');
    end if;
  end loop;

  -- ====================================================== next match (open)
  insert into public.matches (
    title, match_date, match_time, location, description,
    total_expense, voting_deadline, status, voting_open, created_by
  ) values (
    '[demo] Sunday Cricket Match',
    current_date + interval '5 days',
    '07:00',
    'Bangalore Cricket Ground, Koramangala',
    'Demo data. Voting is open — pick Yes / No / Maybe on the match page.',
    3000.00,
    (current_date + interval '4 days')::timestamptz,
    'upcoming',
    true,
    v_admin
  )
  returning id into v_match_next;

  insert into public.match_expenses (match_id, label, amount, category, notes, created_by)
  values
    (v_match_next, '[demo] Ground booking', 2200.00, 'ground', null, v_admin),
    (v_match_next, '[demo] Match balls',     800.00, 'ball',   null, v_admin);

  -- A spread of votes so the live results panel has something to show.
  v_i := 0;
  foreach v_player in array v_players loop
    v_i := v_i + 1;
    insert into public.match_votes (match_id, player_id, vote)
    values (
      v_match_next,
      v_player,
      case when v_i % 5 = 0 then 'no'
           when v_i % 7 = 0 then 'maybe'
           else 'yes' end
    )
    on conflict (match_id, player_id) do nothing;
  end loop;

  -- Provisional split while voting is still open (not finalized).
  perform public.recalculate_match_contributions(
    v_match_next, false, '[demo] provisional split while voting is open'
  );

  -- ============================================ further-out match (no votes)
  insert into public.matches (
    title, match_date, match_time, location, description,
    total_expense, voting_deadline, status, voting_open, created_by
  ) values (
    '[demo] Friendly vs Indiranagar XI',
    current_date + interval '19 days',
    '16:00',
    'Indiranagar Ground',
    'Demo data. Nobody has voted yet.',
    4500.00,
    (current_date + interval '17 days')::timestamptz,
    'upcoming',
    true,
    v_admin
  )
  returning id into v_match_soon;

  raise notice 'Demo seed complete. Matches created: %, %, %', v_match_past, v_match_next, v_match_soon;
  raise notice 'Remove it again with supabase/seed/demo_cleanup.sql';
end
$$;
