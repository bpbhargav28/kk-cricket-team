/**
 * Every Supabase read/write the UI performs lives here, so the data contract is
 * in one place and components stay presentational.
 *
 * Reads rely on Row Level Security to scope rows (a player's `payments` query
 * returns only their own row because of the policy, not because of a filter).
 * Writes that need admin rights go through SECURITY DEFINER RPCs.
 */
import { supabase } from './supabase'
import type {
  ContributionAudit,
  ContributionWithPlayer,
  DashboardSummary,
  Match,
  MatchExpense,
  MatchPaymentSummary,
  MatchStatus,
  MatchVoteSummary,
  Payment,
  PaymentMethod,
  PaymentWithMatch,
  PaymentWithPlayer,
  Profile,
  SplitResult,
  VoteValue,
  VoteWithPlayer,
} from './database.types'

const PLAYER_FIELDS = 'id, full_name, avatar_url, jersey_no'

function unwrap<T>({ data, error }: { data: T | null; error: unknown }): T {
  if (error) throw error
  return data as T
}

/* ========================================================================== */
/*  Dashboard                                                                 */
/* ========================================================================== */

export async function fetchDashboard(): Promise<DashboardSummary> {
  const { data, error } = await supabase.rpc('get_dashboard_summary')
  if (error) throw error
  return data as unknown as DashboardSummary
}

/* ========================================================================== */
/*  Profiles / players                                                        */
/* ========================================================================== */

export async function fetchPlayers(): Promise<Profile[]> {
  return unwrap(
    await supabase
      .from('profiles')
      .select('*')
      .order('is_active', { ascending: false })
      .order('full_name')
  )
}

export async function updatePlayer(
  id: string,
  patch: Partial<Pick<Profile, 'full_name' | 'phone' | 'jersey_no' | 'role' | 'is_active'>>
): Promise<Profile> {
  return unwrap(await supabase.from('profiles').update(patch).eq('id', id).select().single())
}

export async function promoteToAdmin(email: string): Promise<Profile> {
  const { data, error } = await supabase.rpc('promote_to_admin', { p_email: email })
  if (error) throw error
  return data as unknown as Profile
}

/* ========================================================================== */
/*  Matches                                                                   */
/* ========================================================================== */

export interface MatchInput {
  title: string
  match_date: string
  match_time: string
  location: string
  description: string | null
  total_expense: number
  voting_deadline: string | null
}

export async function fetchMatches(filter?: {
  status?: MatchStatus
  /** 'upcoming' = today or later, 'past' = before today. */
  when?: 'upcoming' | 'past'
}): Promise<Match[]> {
  const today = new Date().toISOString().slice(0, 10)
  let query = supabase.from('matches').select('*')

  if (filter?.status) query = query.eq('status', filter.status)
  if (filter?.when === 'upcoming') query = query.gte('match_date', today)
  if (filter?.when === 'past') query = query.lt('match_date', today)

  query =
    filter?.when === 'upcoming'
      ? query.order('match_date', { ascending: true }).order('match_time', { ascending: true })
      : query.order('match_date', { ascending: false }).order('match_time', { ascending: false })

  return unwrap(await query)
}

export async function fetchMatch(id: string): Promise<Match> {
  return unwrap(await supabase.from('matches').select('*').eq('id', id).single())
}

export async function createMatch(input: MatchInput, createdBy: string): Promise<Match> {
  return unwrap(
    await supabase
      .from('matches')
      .insert({ ...input, created_by: createdBy })
      .select()
      .single()
  )
}

export async function updateMatch(id: string, patch: Partial<Match>): Promise<Match> {
  return unwrap(await supabase.from('matches').update(patch).eq('id', id).select().single())
}

export async function cancelMatch(id: string, reason: string): Promise<Match> {
  return updateMatch(id, {
    status: 'cancelled',
    voting_open: false,
    cancellation_reason: reason,
  })
}

export async function completeMatch(id: string): Promise<Match> {
  return updateMatch(id, { status: 'completed', voting_open: false })
}

export async function deleteMatch(id: string): Promise<void> {
  const { error } = await supabase.from('matches').delete().eq('id', id)
  if (error) throw error
}

/* ========================================================================== */
/*  Voting                                                                    */
/* ========================================================================== */

export async function fetchVotes(matchId: string): Promise<VoteWithPlayer[]> {
  return unwrap(
    await supabase
      .from('match_votes')
      .select(`*, player:profiles!match_votes_player_id_fkey(${PLAYER_FIELDS})`)
      .eq('match_id', matchId)
      .order('updated_at', { ascending: true })
  ) as unknown as VoteWithPlayer[]
}

/**
 * Casts or changes a vote. UNIQUE(match_id, player_id) + upsert guarantees one
 * active vote per player, and the RLS policy rejects it once voting is closed.
 */
export async function castVote(
  matchId: string,
  playerId: string,
  vote: VoteValue,
  note?: string | null
): Promise<void> {
  const { error } = await supabase.from('match_votes').upsert(
    { match_id: matchId, player_id: playerId, vote, note: note ?? null },
    { onConflict: 'match_id,player_id' }
  )
  if (error) throw error
}

/** Aggregate vote counts for every match, from the `match_vote_summary` view. */
export async function fetchVoteSummaries(): Promise<MatchVoteSummary[]> {
  return unwrap(await supabase.from('match_vote_summary').select('*'))
}

export async function closeVoting(matchId: string, finalize = true): Promise<SplitResult> {
  const { data, error } = await supabase.rpc('close_voting', {
    p_match_id: matchId,
    p_finalize: finalize,
  })
  if (error) throw error
  return data as unknown as SplitResult
}

export async function reopenVoting(matchId: string): Promise<void> {
  const { error } = await supabase.rpc('reopen_voting', { p_match_id: matchId })
  if (error) throw error
}

/* ========================================================================== */
/*  Expenses & contributions                                                  */
/* ========================================================================== */

export async function fetchExpenseItems(matchId: string): Promise<MatchExpense[]> {
  return unwrap(
    await supabase
      .from('match_expenses')
      .select('*')
      .eq('match_id', matchId)
      .order('created_at', { ascending: true })
  )
}

export async function addExpenseItem(
  matchId: string,
  item: Pick<MatchExpense, 'label' | 'amount' | 'category'> & { notes?: string | null },
  createdBy: string
): Promise<MatchExpense> {
  return unwrap(
    await supabase
      .from('match_expenses')
      .insert({ ...item, match_id: matchId, created_by: createdBy })
      .select()
      .single()
  )
}

export async function deleteExpenseItem(id: string): Promise<void> {
  const { error } = await supabase.from('match_expenses').delete().eq('id', id)
  if (error) throw error
}

export async function fetchContributions(matchId: string): Promise<ContributionWithPlayer[]> {
  return unwrap(
    await supabase
      .from('player_contributions')
      .select(`*, player:profiles!player_contributions_player_id_fkey(${PLAYER_FIELDS})`)
      .eq('match_id', matchId)
  ) as unknown as ContributionWithPlayer[]
}

export async function recalculateContributions(
  matchId: string,
  force = false,
  reason?: string
): Promise<SplitResult> {
  const { data, error } = await supabase.rpc('recalculate_match_contributions', {
    p_match_id: matchId,
    p_force: force,
    p_reason: reason ?? null,
  })
  if (error) throw error
  return data as unknown as SplitResult
}

export async function setManualContribution(
  matchId: string,
  playerId: string,
  amount: number,
  reason?: string
): Promise<SplitResult> {
  const { data, error } = await supabase.rpc('set_manual_contribution', {
    p_match_id: matchId,
    p_player_id: playerId,
    p_amount: amount,
    p_reason: reason ?? null,
  })
  if (error) throw error
  return data as unknown as SplitResult
}

export async function clearManualContribution(
  matchId: string,
  playerId: string
): Promise<SplitResult> {
  const { data, error } = await supabase.rpc('clear_manual_contribution', {
    p_match_id: matchId,
    p_player_id: playerId,
  })
  if (error) throw error
  return data as unknown as SplitResult
}

export async function setPlayerExemption(
  matchId: string,
  playerId: string,
  exempt: boolean,
  reason?: string
): Promise<SplitResult> {
  const { data, error } = await supabase.rpc('set_player_exemption', {
    p_match_id: matchId,
    p_player_id: playerId,
    p_exempt: exempt,
    p_reason: reason ?? null,
  })
  if (error) throw error
  return data as unknown as SplitResult
}

/* ========================================================================== */
/*  Payments                                                                  */
/* ========================================================================== */

/**
 * RLS returns every row for admins and only the caller's own row for players,
 * so this one query serves both the admin payment manager and the player view.
 */
export async function fetchMatchPayments(matchId: string): Promise<PaymentWithPlayer[]> {
  return unwrap(
    await supabase
      .from('payments')
      .select(`*, player:profiles!payments_player_id_fkey(${PLAYER_FIELDS})`)
      .eq('match_id', matchId)
  ) as unknown as PaymentWithPlayer[]
}

export async function fetchMyPayments(playerId: string): Promise<PaymentWithMatch[]> {
  return unwrap(
    await supabase
      .from('payments')
      .select('*, match:matches!payments_match_id_fkey(id, title, match_date, location, status)')
      .eq('player_id', playerId)
      .order('created_at', { ascending: false })
  ) as unknown as PaymentWithMatch[]
}

export async function fetchPaymentSummaries(): Promise<MatchPaymentSummary[]> {
  return unwrap(
    await supabase
      .from('match_payment_summary')
      .select('*')
      .order('match_date', { ascending: false })
  )
}

export async function fetchPaymentSummary(matchId: string): Promise<MatchPaymentSummary | null> {
  const { data, error } = await supabase
    .from('match_payment_summary')
    .select('*')
    .eq('match_id', matchId)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function recordPayment(
  matchId: string,
  playerId: string,
  amountPaid: number,
  method?: PaymentMethod | null,
  notes?: string | null
): Promise<Payment> {
  const { data, error } = await supabase.rpc('record_payment', {
    p_match_id: matchId,
    p_player_id: playerId,
    p_amount_paid: amountPaid,
    p_method: method ?? null,
    p_notes: notes ?? null,
  })
  if (error) throw error
  return data as unknown as Payment
}

export async function markPaymentPaid(
  matchId: string,
  playerId: string,
  method: PaymentMethod = 'cash'
): Promise<Payment> {
  const { data, error } = await supabase.rpc('mark_payment_paid', {
    p_match_id: matchId,
    p_player_id: playerId,
    p_method: method,
  })
  if (error) throw error
  return data as unknown as Payment
}

/* ========================================================================== */
/*  Audit trail                                                               */
/* ========================================================================== */

export async function fetchAuditTrail(matchId: string): Promise<ContributionAudit[]> {
  return unwrap(
    await supabase
      .from('contribution_audit')
      .select('*')
      .eq('match_id', matchId)
      .order('created_at', { ascending: false })
      .limit(60)
  )
}
