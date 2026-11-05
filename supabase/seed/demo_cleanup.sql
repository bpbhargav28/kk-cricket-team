-- ===========================================================================
--  KK Cricket Team — remove demo data
-- ===========================================================================
--
--  Deletes only the rows created by supabase/seed/demo_data.sql, identified by
--  the '[demo]' prefix on the match title. Real matches, real players and real
--  payments are never touched.
--
--  Votes, contributions, payments, expense items and audit rows are removed by
--  the ON DELETE CASCADE foreign keys on match_id.
--
--  Same opt-in guard as the seed script: uncomment the `set` line, or run it
--  in the same batch.
-- ===========================================================================

-- set local "kk.demo" = 'yes-i-am-on-a-dev-project';

do $$
declare
  v_optin   text := current_setting('kk.demo', true);
  v_deleted int;
begin
  if v_optin is distinct from 'yes-i-am-on-a-dev-project' then
    raise exception
      'Demo cleanup refused. Set "kk.demo" to opt in — see the header of this file.';
  end if;

  with removed as (
    delete from public.matches
     where title like '[demo]%'
    returning 1
  )
  select count(*) into v_deleted from removed;

  delete from public.match_expenses where label like '[demo]%';

  raise notice 'Removed % demo match(es) and all of their votes, contributions and payments.', v_deleted;
end
$$;
