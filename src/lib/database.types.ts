/**
 * Hand-maintained mirror of the Supabase schema in `supabase/migrations`.
 *
 * Regenerate with:
 *   npx supabase gen types typescript --project-id <ref> > src/lib/database.types.ts
 * …but keep the hand-written `Enums` and relationship helpers below in sync.
 */

export type Role = 'admin' | 'player'
export type VoteValue = 'yes' | 'no' | 'maybe'
export type MatchStatus = 'upcoming' | 'completed' | 'cancelled'
export type PaymentStatus = 'pending' | 'partially_paid' | 'paid'
export type PaymentMethod = 'cash' | 'upi' | 'bank_transfer' | 'other'
export type ExpenseCategory =
  | 'ground'
  | 'ball'
  | 'kit'
  | 'refreshments'
  | 'umpire'
  | 'travel'
  | 'other'
export type AuditAction =
  | 'recalculated'
  | 'manual_override'
  | 'override_cleared'
  | 'exempted'
  | 'exemption_removed'
  | 'payment_recorded'
  | 'expense_changed'
  | 'voting_closed'
  | 'voting_reopened'
  | 'finalized'
  | 'match_cancelled'

export type Profile = {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  role: Role
  jersey_no: number | null
  is_active: boolean
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export type Match = {
  id: string
  title: string
  /** ISO date, e.g. "2026-11-15" */
  match_date: string
  /** 24h time, e.g. "07:30:00" */
  match_time: string
  location: string
  description: string | null
  total_expense: number
  voting_deadline: string | null
  status: MatchStatus
  voting_open: boolean
  contributions_finalized: boolean
  finalized_at: string | null
  cancellation_reason: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type MatchVote = {
  id: string
  match_id: string
  player_id: string
  vote: VoteValue
  note: string | null
  created_at: string
  updated_at: string
}

export type MatchExpense = {
  id: string
  match_id: string
  label: string
  amount: number
  category: ExpenseCategory
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type PlayerContribution = {
  id: string
  match_id: string
  player_id: string
  amount_due: number
  is_exempt: boolean
  is_manual_override: boolean
  override_reason: string | null
  created_at: string
  updated_at: string
}

export type Payment = {
  id: string
  match_id: string
  player_id: string
  amount_due: number
  amount_paid: number
  status: PaymentStatus
  payment_date: string | null
  method: PaymentMethod | null
  notes: string | null
  recorded_by: string | null
  created_at: string
  updated_at: string
}

export type ContributionAudit = {
  id: number
  match_id: string
  player_id: string | null
  action: AuditAction
  old_value: unknown
  new_value: unknown
  reason: string | null
  changed_by: string | null
  created_at: string
}

export type MatchPaymentSummary = {
  match_id: string
  title: string
  match_date: string
  total_expense: number
  total_due: number
  total_collected: number
  outstanding: number
  contributors: number
  paid_count: number
  partially_paid_count: number
  pending_count: number
}

export type MatchVoteSummary = {
  match_id: string
  yes_count: number
  no_count: number
  maybe_count: number
  total_votes: number
  active_players: number
}

/** Result of `recalculate_match_contributions()` / `close_voting()`. */
export type SplitResult = {
  match_id: string
  total_expense: number
  total_assigned: number
  unallocated: number
  split_between: number
  per_player: number
  fixed_total: number
  withdrawn_paid: number
  was_finalized: boolean
  forced: boolean
}

/** Result of `get_dashboard_summary()`. */
export type DashboardSummary = {
  next_match: Pick<
    Match,
    | 'id'
    | 'title'
    | 'match_date'
    | 'match_time'
    | 'location'
    | 'description'
    | 'total_expense'
    | 'voting_deadline'
    | 'voting_open'
    | 'contributions_finalized'
    | 'status'
  > | null
  total_players: number
  attending: number
  not_attending: number
  maybe: number
  per_player_estimate: number
  my_vote: VoteValue | null
  my_share: number | null
  my_total_due: number
  my_outstanding: number
  my_pending_matches: number
}

/* -------------------------------------------------------------------------- */
/*  Composed shapes used by the UI                                            */
/* -------------------------------------------------------------------------- */

export interface VoteWithPlayer extends MatchVote {
  player: Pick<Profile, 'id' | 'full_name' | 'avatar_url' | 'jersey_no'> | null
}

export interface ContributionWithPlayer extends PlayerContribution {
  player: Pick<Profile, 'id' | 'full_name' | 'avatar_url' | 'jersey_no'> | null
}

export interface PaymentWithPlayer extends Payment {
  player: Pick<Profile, 'id' | 'full_name' | 'avatar_url' | 'jersey_no'> | null
}

export interface PaymentWithMatch extends Payment {
  match: Pick<Match, 'id' | 'title' | 'match_date' | 'location' | 'status'> | null
}

/* -------------------------------------------------------------------------- */
/*  Minimal typed Database definition for the supabase-js generic             */
/* -------------------------------------------------------------------------- */

type Row<T> = { Row: T; Insert: Partial<T>; Update: Partial<T>; Relationships: [] }

export interface Database {
  public: {
    Tables: {
      profiles: Row<Profile>
      matches: Row<Match>
      match_votes: Row<MatchVote>
      match_expenses: Row<MatchExpense>
      player_contributions: Row<PlayerContribution>
      payments: Row<Payment>
      contribution_audit: Row<ContributionAudit>
    }
    Views: {
      match_payment_summary: { Row: MatchPaymentSummary; Relationships: [] }
      match_vote_summary: { Row: MatchVoteSummary; Relationships: [] }
    }
    Functions: {
      recalculate_match_contributions: {
        Args: { p_match_id: string; p_force?: boolean; p_reason?: string | null }
        Returns: SplitResult
      }
      set_manual_contribution: {
        Args: {
          p_match_id: string
          p_player_id: string
          p_amount: number
          p_reason?: string | null
        }
        Returns: SplitResult
      }
      clear_manual_contribution: {
        Args: { p_match_id: string; p_player_id: string }
        Returns: SplitResult
      }
      set_player_exemption: {
        Args: {
          p_match_id: string
          p_player_id: string
          p_exempt: boolean
          p_reason?: string | null
        }
        Returns: SplitResult
      }
      close_voting: {
        Args: { p_match_id: string; p_finalize?: boolean }
        Returns: SplitResult
      }
      reopen_voting: { Args: { p_match_id: string }; Returns: undefined }
      record_payment: {
        Args: {
          p_match_id: string
          p_player_id: string
          p_amount_paid: number
          p_method?: PaymentMethod | null
          p_notes?: string | null
        }
        Returns: Payment
      }
      mark_payment_paid: {
        Args: { p_match_id: string; p_player_id: string; p_method?: PaymentMethod }
        Returns: Payment
      }
      promote_to_admin: { Args: { p_email: string }; Returns: Profile }
      get_dashboard_summary: { Args: Record<string, never>; Returns: DashboardSummary }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
