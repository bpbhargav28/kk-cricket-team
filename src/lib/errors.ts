/**
 * Turns Supabase / Postgres errors into something a non-technical cricketer can
 * act on. Postgres error codes and RLS failures are otherwise cryptic.
 */

interface MaybePostgrestError {
  message?: string
  code?: string
  details?: string
  hint?: string
  status?: number
}

const CODE_MESSAGES: Record<string, string> = {
  '23505': 'That record already exists.',
  '23503': 'A linked record is missing. Refresh the page and try again.',
  '23514': 'Those values are not allowed. Please check the form.',
  '42501': 'You do not have permission to do that.',
  P0001: '', // raise_exception — the message itself is already human-readable
  PGRST116: 'No matching record was found.',
  PGRST301: 'Your session expired. Please sign in again.',
  '23P01': 'That change conflicts with existing data.',
}

const UNIQUE_CONSTRAINT_MESSAGES: Record<string, string> = {
  match_votes_unique_player: 'You have already voted for this match — change your vote instead.',
  player_contributions_unique_player: 'This player already has a contribution for the match.',
  payments_unique_player: 'This player already has a payment record for the match.',
  profiles_email_key: 'Another member is already using that email address.',
}

/** Known auth messages that benefit from being rephrased. */
const AUTH_MESSAGES: Array<[RegExp, string]> = [
  [/invalid login credentials/i, 'That email and password combination is not correct.'],
  [/email not confirmed/i, 'Please confirm your email address first — check your inbox.'],
  [/user already registered/i, 'An account with that email already exists. Try signing in.'],
  [/password should be at least/i, 'Your password must be at least 8 characters long.'],
  [
    /for security purposes, you can only request this after/i,
    'Too many attempts. Please wait a moment and try again.',
  ],
  [/rate limit|too many requests/i, 'Too many attempts. Please wait a minute and try again.'],
  [/failed to fetch|networkerror|network request failed/i,
    'Could not reach the server. Check your internet connection and try again.'],
]

export function friendlyError(error: unknown, fallback = 'Something went wrong.'): string {
  if (!error) return fallback

  if (typeof error === 'string') return error

  const err = error as MaybePostgrestError & { error_description?: string }
  const raw = err.message ?? err.error_description ?? ''

  for (const [pattern, message] of AUTH_MESSAGES) {
    if (pattern.test(raw)) return message
  }

  // Unique-constraint violations name the constraint in `message`/`details`.
  if (err.code === '23505') {
    const haystack = `${raw} ${err.details ?? ''}`
    for (const [constraint, message] of Object.entries(UNIQUE_CONSTRAINT_MESSAGES)) {
      if (haystack.includes(constraint)) return message
    }
  }

  // RLS denial on INSERT surfaces as this, which means nothing to a user.
  if (/row-level security|violates row-level security policy/i.test(raw)) {
    return 'You do not have permission to do that, or voting has already closed.'
  }

  if (err.code && CODE_MESSAGES[err.code]) return CODE_MESSAGES[err.code]

  return raw || fallback
}

/** `true` when the error is the "already finalized, pass p_force" guard. */
export function isFinalizedGuard(error: unknown): boolean {
  const raw = (error as MaybePostgrestError)?.message ?? ''
  return /already finalized/i.test(raw)
}
