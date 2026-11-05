-- ============================================================================
-- KK CRICKET TEAM — 03. Business logic
-- ----------------------------------------------------------------------------
-- All privileged operations live here as SECURITY DEFINER functions that
-- re-check `is_admin()` themselves. The frontend never needs — and never gets —
-- a service-role key.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Internal: raise unless the caller is an active admin.
-- ---------------------------------------------------------------------------
create or replace function public.assert_admin()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'You must be signed in to do that.' using errcode = 'insufficient_privilege';
  end if;
  if not public.is_admin(v_uid) then
    raise exception 'Admin privileges are required for this action.' using errcode = 'insufficient_privilege';
  end if;
  return v_uid;
end;
$$;

revoke all on function public.assert_admin() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Keep payments.amount_due in lockstep with player_contributions.amount_due.
-- Denormalising it is what lets payments.status be a generated column.
-- ---------------------------------------------------------------------------
create or replace function public.sync_payment_from_contribution()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    -- Only discard the payment row when no money has changed hands; otherwise
    -- keep it (amount_due 0 ⇒ the team owes this player a refund) so cash is
    -- never silently lost from the ledger.
    delete from public.payments
    where match_id = old.match_id and player_id = old.player_id and amount_paid = 0;

    update public.payments
       set amount_due = 0
     where match_id = old.match_id and player_id = old.player_id and amount_paid > 0;

    return old;
  end if;

  insert into public.payments (match_id, player_id, amount_due)
  values (new.match_id, new.player_id, case when new.is_exempt then 0 else new.amount_due end)
  on conflict (match_id, player_id) do update
    set amount_due = excluded.amount_due,
        updated_at = now();

  return new;
end;
$$;

drop trigger if exists sync_payment on public.player_contributions;
create trigger sync_payment
  after insert or update of amount_due, is_exempt or delete on public.player_contributions
  for each row execute function public.sync_payment_from_contribution();

-- ---------------------------------------------------------------------------
-- Audit any change to a match's headline expense.
-- ---------------------------------------------------------------------------
create or replace function public.audit_match_expense_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.total_expense is distinct from old.total_expense then
    insert into public.contribution_audit (match_id, action, old_value, new_value, changed_by)
    values (
      new.id,
      'expense_changed',
      jsonb_build_object('total_expense', old.total_expense, 'finalized', old.contributions_finalized),
      jsonb_build_object('total_expense', new.total_expense, 'finalized', new.contributions_finalized),
      auth.uid()
    );
  end if;

  if new.status = 'cancelled' and old.status <> 'cancelled' then
    insert into public.contribution_audit (match_id, action, old_value, new_value, reason, changed_by)
    values (
      new.id, 'match_cancelled',
      jsonb_build_object('status', old.status),
      jsonb_build_object('status', new.status),
      new.cancellation_reason, auth.uid()
    );
  end if;

  return new;
end;
$$;

drop trigger if exists audit_expense_change on public.matches;
create trigger audit_expense_change
  after update on public.matches
  for each row execute function public.audit_match_expense_change();

-- ===========================================================================
-- recalculate_match_contributions
-- ---------------------------------------------------------------------------
-- The heart of the expense splitter.
--
--   1. Exempt players owe nothing.
--   2. Manually overridden players keep exactly the amount the admin typed.
--   3. Whatever is left of total_expense is divided between the remaining
--      confirmed ("yes") players.
--   4. The division is done in integer paise and the leftover remainder is
--      handed out one paisa at a time in a deterministic order, so
--      SUM(amount_due) === matches.total_expense to the last paisa.
--   5. If the match has already been finalized the function refuses unless
--      p_force is true — and every run writes a contribution_audit row.
--
-- Returns a jsonb summary the UI shows in its confirmation dialog.
-- ===========================================================================
create or replace function public.recalculate_match_contributions(
  p_match_id uuid,
  p_force    boolean default false,
  p_reason   text    default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin        uuid := public.assert_admin();
  v_match         public.matches;
  v_old          jsonb;
  v_new          jsonb;
  v_total_paise  bigint;
  v_fixed_paise  bigint;
  v_pool_paise   bigint;
  v_pool_size    int;
  v_base         bigint;
  v_remainder    bigint;
  v_assigned     numeric(12, 2);
  v_withdrawn    int := 0;
begin
  select * into v_match from public.matches where id = p_match_id for update;
  if not found then
    raise exception 'Match not found.' using errcode = 'no_data_found';
  end if;

  if v_match.status = 'cancelled' then
    raise exception 'This match is cancelled; its contributions cannot be recalculated.'
      using errcode = 'check_violation';
  end if;

  if v_match.contributions_finalized and not p_force then
    raise exception
      'Contributions for "%" are already finalized. Confirm the change to re-split them.', v_match.title
      using errcode = 'raise_exception', hint = 'Call with p_force := true after confirming with the admin.';
  end if;

  -- Snapshot for the audit trail before touching anything.
  select coalesce(
           jsonb_agg(jsonb_build_object(
             'player_id', c.player_id,
             'amount_due', c.amount_due,
             'is_exempt', c.is_exempt,
             'is_manual_override', c.is_manual_override
           ) order by c.player_id),
           '[]'::jsonb
         )
    into v_old
  from public.player_contributions c
  where c.match_id = p_match_id;

  -- -------------------------------------------------------------------------
  -- Step 1 — players who already paid something but are no longer confirmed.
  -- Their row is preserved as a manual override so the cash stays accounted
  -- for and an admin can arrange a refund deliberately.
  -- -------------------------------------------------------------------------
  with withdrawn as (
    update public.player_contributions c
       set is_manual_override = true,
           override_reason = coalesce(c.override_reason, 'Paid, then withdrew from the match — needs a refund decision.')
     where c.match_id = p_match_id
       and not c.is_manual_override
       and exists (
         select 1 from public.payments pay
         where pay.match_id = c.match_id and pay.player_id = c.player_id and pay.amount_paid > 0
       )
       and not exists (
         select 1 from public.match_votes v
         where v.match_id = c.match_id and v.player_id = c.player_id and v.vote = 'yes'
       )
    returning 1
  )
  select count(*) into v_withdrawn from withdrawn;

  -- -------------------------------------------------------------------------
  -- Step 2 — drop rows for players who are no longer confirmed and have paid
  -- nothing. (The payments row goes with it via sync_payment_from_contribution.)
  -- -------------------------------------------------------------------------
  delete from public.player_contributions c
  where c.match_id = p_match_id
    and not c.is_manual_override
    and not c.is_exempt
    and not exists (
      select 1 from public.match_votes v
      where v.match_id = c.match_id and v.player_id = c.player_id and v.vote = 'yes'
    );

  -- -------------------------------------------------------------------------
  -- Step 3 — make sure every confirmed player has a row.
  -- -------------------------------------------------------------------------
  insert into public.player_contributions (match_id, player_id, amount_due)
  select p_match_id, v.player_id, 0
  from public.match_votes v
  where v.match_id = p_match_id and v.vote = 'yes'
  on conflict (match_id, player_id) do nothing;

  -- -------------------------------------------------------------------------
  -- Step 4 — exempt players owe nothing.
  -- -------------------------------------------------------------------------
  update public.player_contributions
     set amount_due = 0
   where match_id = p_match_id and is_exempt and amount_due <> 0;

  -- -------------------------------------------------------------------------
  -- Step 5 — work out the pool to be split.
  -- -------------------------------------------------------------------------
  v_total_paise := round(v_match.total_expense * 100)::bigint;

  select coalesce(sum(round(amount_due * 100)::bigint), 0)
    into v_fixed_paise
  from public.player_contributions
  where match_id = p_match_id and is_manual_override and not is_exempt;

  select count(*)
    into v_pool_size
  from public.player_contributions
  where match_id = p_match_id and not is_manual_override and not is_exempt;

  v_pool_paise := greatest(v_total_paise - v_fixed_paise, 0);

  if v_pool_size > 0 then
    v_base      := v_pool_paise / v_pool_size;      -- integer division, floor
    v_remainder := v_pool_paise % v_pool_size;      -- 0 .. v_pool_size-1 paise left over

    -- Hand the leftover paise to the first `v_remainder` players in a stable
    -- order so repeated runs produce identical amounts and the sum is exact.
    with ranked as (
      select c.id,
             row_number() over (order by lower(pr.full_name), c.player_id) as rn
      from public.player_contributions c
      join public.profiles pr on pr.id = c.player_id
      where c.match_id = p_match_id
        and not c.is_manual_override
        and not c.is_exempt
    )
    update public.player_contributions c
       set amount_due = ((v_base + case when r.rn <= v_remainder then 1 else 0 end)::numeric / 100)
      from ranked r
     where c.id = r.id;
  end if;

  -- -------------------------------------------------------------------------
  -- Step 6 — audit + report.
  -- -------------------------------------------------------------------------
  select coalesce(
           jsonb_agg(jsonb_build_object(
             'player_id', c.player_id,
             'amount_due', c.amount_due,
             'is_exempt', c.is_exempt,
             'is_manual_override', c.is_manual_override
           ) order by c.player_id),
           '[]'::jsonb
         ),
         coalesce(sum(c.amount_due), 0)
    into v_new, v_assigned
  from public.player_contributions c
  where c.match_id = p_match_id;

  insert into public.contribution_audit (match_id, action, old_value, new_value, reason, changed_by)
  values (
    p_match_id,
    'recalculated',
    jsonb_build_object('contributions', v_old, 'total_expense', v_match.total_expense),
    jsonb_build_object('contributions', v_new, 'total_expense', v_match.total_expense,
                       'forced', p_force, 'was_finalized', v_match.contributions_finalized),
    p_reason,
    v_admin
  );

  return jsonb_build_object(
    'match_id',          p_match_id,
    'total_expense',     v_match.total_expense,
    'total_assigned',    v_assigned,
    'unallocated',       round(v_match.total_expense - v_assigned, 2),
    'split_between',     v_pool_size,
    'per_player',        case when v_pool_size > 0
                              then round((v_pool_paise::numeric / v_pool_size) / 100, 2)
                              else 0 end,
    'fixed_total',       (v_fixed_paise::numeric / 100),
    'withdrawn_paid',    v_withdrawn,
    'was_finalized',     v_match.contributions_finalized,
    'forced',            p_force
  );
end;
$$;

-- ===========================================================================
-- Manual per-player adjustment
-- ===========================================================================
create or replace function public.set_manual_contribution(
  p_match_id  uuid,
  p_player_id uuid,
  p_amount    numeric,
  p_reason    text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := public.assert_admin();
  v_old   numeric(12, 2);
begin
  if p_amount is null or p_amount < 0 then
    raise exception 'A manual contribution must be zero or more.' using errcode = 'check_violation';
  end if;

  select amount_due into v_old
  from public.player_contributions
  where match_id = p_match_id and player_id = p_player_id;

  insert into public.player_contributions (match_id, player_id, amount_due, is_manual_override, override_reason)
  values (p_match_id, p_player_id, round(p_amount, 2), true, p_reason)
  on conflict (match_id, player_id) do update
    set amount_due         = round(p_amount, 2),
        is_manual_override = true,
        override_reason    = coalesce(p_reason, player_contributions.override_reason),
        updated_at         = now();

  insert into public.contribution_audit (match_id, player_id, action, old_value, new_value, reason, changed_by)
  values (
    p_match_id, p_player_id, 'manual_override',
    jsonb_build_object('amount_due', v_old),
    jsonb_build_object('amount_due', round(p_amount, 2)),
    p_reason, v_admin
  );

  -- Re-split the remainder so the other players still cover the full expense.
  return public.recalculate_match_contributions(p_match_id, true, coalesce(p_reason, 'Manual adjustment'));
end;
$$;

create or replace function public.clear_manual_contribution(
  p_match_id  uuid,
  p_player_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := public.assert_admin();
  v_old   numeric(12, 2);
begin
  select amount_due into v_old
  from public.player_contributions
  where match_id = p_match_id and player_id = p_player_id;

  update public.player_contributions
     set is_manual_override = false,
         override_reason    = null,
         updated_at         = now()
   where match_id = p_match_id and player_id = p_player_id;

  insert into public.contribution_audit (match_id, player_id, action, old_value, new_value, changed_by)
  values (p_match_id, p_player_id, 'override_cleared',
          jsonb_build_object('amount_due', v_old), null, v_admin);

  return public.recalculate_match_contributions(p_match_id, true, 'Manual adjustment removed');
end;
$$;

-- ===========================================================================
-- Exemptions
-- ===========================================================================
create or replace function public.set_player_exemption(
  p_match_id  uuid,
  p_player_id uuid,
  p_exempt    boolean,
  p_reason    text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := public.assert_admin();
  v_old   jsonb;
begin
  select jsonb_build_object('amount_due', amount_due, 'is_exempt', is_exempt)
    into v_old
  from public.player_contributions
  where match_id = p_match_id and player_id = p_player_id;

  insert into public.player_contributions (match_id, player_id, amount_due, is_exempt, override_reason)
  values (p_match_id, p_player_id, 0, p_exempt, p_reason)
  on conflict (match_id, player_id) do update
    set is_exempt          = p_exempt,
        amount_due         = case when p_exempt then 0 else player_contributions.amount_due end,
        is_manual_override = case when p_exempt then false else player_contributions.is_manual_override end,
        override_reason    = case when p_exempt then p_reason else null end,
        updated_at         = now();

  insert into public.contribution_audit (match_id, player_id, action, old_value, new_value, reason, changed_by)
  values (
    p_match_id, p_player_id,
    case when p_exempt then 'exempted' else 'exemption_removed' end,
    v_old,
    jsonb_build_object('is_exempt', p_exempt),
    p_reason, v_admin
  );

  return public.recalculate_match_contributions(
    p_match_id, true,
    case when p_exempt then 'Player exempted from payment' else 'Exemption removed' end
  );
end;
$$;

-- ===========================================================================
-- Voting control
-- ===========================================================================
create or replace function public.close_voting(
  p_match_id uuid,
  p_finalize boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin  uuid := public.assert_admin();
  v_result jsonb;
begin
  update public.matches
     set voting_open = false,
         updated_at  = now()
   where id = p_match_id;

  if not found then
    raise exception 'Match not found.' using errcode = 'no_data_found';
  end if;

  insert into public.contribution_audit (match_id, action, new_value, changed_by)
  values (p_match_id, 'voting_closed', jsonb_build_object('finalize', p_finalize), v_admin);

  v_result := public.recalculate_match_contributions(p_match_id, true, 'Voting closed');

  if p_finalize then
    update public.matches
       set contributions_finalized = true,
           finalized_at            = coalesce(finalized_at, now())
     where id = p_match_id;

    insert into public.contribution_audit (match_id, action, new_value, changed_by)
    values (p_match_id, 'finalized', v_result, v_admin);
  end if;

  return v_result;
end;
$$;

create or replace function public.reopen_voting(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := public.assert_admin();
begin
  update public.matches
     set voting_open = true,
         updated_at  = now()
   where id = p_match_id and status = 'upcoming';

  if not found then
    raise exception 'Only an upcoming match can have its voting reopened.' using errcode = 'check_violation';
  end if;

  insert into public.contribution_audit (match_id, action, changed_by)
  values (p_match_id, 'voting_reopened', v_admin);
end;
$$;

-- ===========================================================================
-- Payment recording (admin only — players can never mark themselves paid)
-- ===========================================================================
create or replace function public.record_payment(
  p_match_id   uuid,
  p_player_id  uuid,
  p_amount_paid numeric,
  p_method     text default null,
  p_notes      text default null
)
returns public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := public.assert_admin();
  v_old   public.payments;
  v_row   public.payments;
begin
  if p_amount_paid is null or p_amount_paid < 0 then
    raise exception 'Amount paid must be zero or more.' using errcode = 'check_violation';
  end if;

  select * into v_old from public.payments
  where match_id = p_match_id and player_id = p_player_id;

  if not found then
    raise exception 'This player has no contribution for the match yet.' using errcode = 'no_data_found';
  end if;

  update public.payments
     set amount_paid  = round(p_amount_paid, 2),
         method       = coalesce(p_method, method),
         notes        = coalesce(p_notes, notes),
         payment_date = case when p_amount_paid > 0 then coalesce(payment_date, now()) else null end,
         recorded_by  = v_admin,
         updated_at   = now()
   where match_id = p_match_id and player_id = p_player_id
  returning * into v_row;

  insert into public.contribution_audit (match_id, player_id, action, old_value, new_value, reason, changed_by)
  values (
    p_match_id, p_player_id, 'payment_recorded',
    jsonb_build_object('amount_paid', v_old.amount_paid, 'status', v_old.status),
    jsonb_build_object('amount_paid', v_row.amount_paid, 'status', v_row.status, 'method', v_row.method),
    p_notes, v_admin
  );

  return v_row;
end;
$$;

-- Convenience wrapper used by the "Mark as paid" button.
create or replace function public.mark_payment_paid(
  p_match_id  uuid,
  p_player_id uuid,
  p_method    text default 'cash'
)
returns public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_due numeric(12, 2);
begin
  perform public.assert_admin();

  select amount_due into v_due from public.payments
  where match_id = p_match_id and player_id = p_player_id;

  if v_due is null then
    raise exception 'This player has no contribution for the match yet.' using errcode = 'no_data_found';
  end if;

  return public.record_payment(p_match_id, p_player_id, v_due, p_method, null);
end;
$$;

-- ===========================================================================
-- Admin bootstrap / management
-- ---------------------------------------------------------------------------
-- Allowed when the caller is already an admin, OR when the team has no admin
-- at all yet (first-run bootstrap). Once the first admin exists this becomes
-- an admin-only operation, so it can never be used to escalate privileges.
-- ===========================================================================
create or replace function public.promote_to_admin(p_email text)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_any_admin boolean;
  v_row       public.profiles;
  v_my_email  text;
begin
  select exists (select 1 from public.profiles where role = 'admin' and is_active)
    into v_any_admin;

  if v_any_admin then
    if not public.is_admin() then
      raise exception 'Only an existing admin can promote another member.'
        using errcode = 'insufficient_privilege';
    end if;
  else
    -- Bootstrap window: no admin exists yet. Only self-promotion is allowed, so
    -- the first signed-in member can claim admin but cannot hand it to anyone
    -- else. Close this window immediately after setup (see README).
    select email into v_my_email from public.profiles where id = auth.uid();
    if v_my_email is null or lower(v_my_email) <> lower(btrim(p_email)) then
      raise exception 'No admin exists yet — only the signed-in member can claim the first admin account.'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  update public.profiles
     set role = 'admin', updated_at = now()
   where lower(email) = lower(btrim(p_email))
  returning * into v_row;

  if v_row.id is null then
    raise exception 'No team member found with email %. Ask them to sign up first.', p_email
      using errcode = 'no_data_found';
  end if;

  return v_row;
end;
$$;

-- ===========================================================================
-- Dashboard aggregate — one round trip instead of five.
-- ===========================================================================
create or replace function public.get_dashboard_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid         uuid := auth.uid();
  v_next        public.matches;
  v_total       int;
  v_yes         int;
  v_no          int;
  v_maybe       int;
  v_pending     int;
  v_my_due      numeric(12, 2);
  v_my_outstanding numeric(12, 2);
  v_my_vote     text;
  v_my_share    numeric(12, 2);
  v_per_player  numeric(12, 2);
begin
  if v_uid is null or not public.is_team_member(v_uid) then
    raise exception 'You must be signed in as a team member.' using errcode = 'insufficient_privilege';
  end if;

  select * into v_next
  from public.matches
  where status = 'upcoming'
    and (match_date + match_time) >= (now() at time zone 'Asia/Kolkata') - interval '6 hours'
  order by match_date, match_time
  limit 1;

  select count(*) into v_total from public.profiles where is_active;

  if v_next.id is not null then
    select
      count(*) filter (where vote = 'yes'),
      count(*) filter (where vote = 'no'),
      count(*) filter (where vote = 'maybe')
    into v_yes, v_no, v_maybe
    from public.match_votes where match_id = v_next.id;

    select vote into v_my_vote
    from public.match_votes where match_id = v_next.id and player_id = v_uid;

    select amount_due into v_my_share
    from public.player_contributions where match_id = v_next.id and player_id = v_uid;

    v_per_player := case when coalesce(v_yes, 0) > 0
                         then round(v_next.total_expense / v_yes, 2)
                         else 0 end;
  end if;

  select
    coalesce(sum(amount_due), 0),
    coalesce(sum(greatest(amount_due - amount_paid, 0)), 0)
  into v_my_due, v_my_outstanding
  from public.payments where player_id = v_uid;

  select count(*) into v_pending
  from public.payments where player_id = v_uid and status <> 'paid';

  return jsonb_build_object(
    'next_match', case when v_next.id is null then null else jsonb_build_object(
        'id', v_next.id,
        'title', v_next.title,
        'match_date', v_next.match_date,
        'match_time', v_next.match_time,
        'location', v_next.location,
        'description', v_next.description,
        'total_expense', v_next.total_expense,
        'voting_deadline', v_next.voting_deadline,
        'voting_open', v_next.voting_open,
        'contributions_finalized', v_next.contributions_finalized,
        'status', v_next.status
      ) end,
    'total_players',      coalesce(v_total, 0),
    'attending',          coalesce(v_yes, 0),
    'not_attending',      coalesce(v_no, 0),
    'maybe',              coalesce(v_maybe, 0),
    'per_player_estimate', coalesce(v_per_player, 0),
    'my_vote',            v_my_vote,
    'my_share',           v_my_share,
    'my_total_due',       coalesce(v_my_due, 0),
    'my_outstanding',     coalesce(v_my_outstanding, 0),
    'my_pending_matches', coalesce(v_pending, 0)
  );
end;
$$;

-- ===========================================================================
-- Grants — authenticated only. `anon` can call nothing.
-- ===========================================================================
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'recalculate_match_contributions(uuid, boolean, text)',
    'set_manual_contribution(uuid, uuid, numeric, text)',
    'clear_manual_contribution(uuid, uuid)',
    'set_player_exemption(uuid, uuid, boolean, text)',
    'close_voting(uuid, boolean)',
    'reopen_voting(uuid)',
    'record_payment(uuid, uuid, numeric, text, text)',
    'mark_payment_paid(uuid, uuid, text)',
    'promote_to_admin(text)',
    'get_dashboard_summary()'
  ]
  loop
    execute format('revoke all on function public.%s from public, anon', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;
end;
$$;
