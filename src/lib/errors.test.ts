import { describe, it, expect } from 'vitest'
import { friendlyError, isFinalizedGuard } from './errors'

describe('friendlyError', () => {
  it('returns fallback for null/undefined', () => {
    expect(friendlyError(null)).toBe('Something went wrong.')
    expect(friendlyError(undefined)).toBe('Something went wrong.')
  })

  it('returns custom fallback', () => {
    expect(friendlyError(null, 'Oops!')).toBe('Oops!')
  })

  it('returns string errors as-is', () => {
    expect(friendlyError('Custom error message')).toBe('Custom error message')
  })

  it('maps Postgres error code 23505', () => {
    expect(friendlyError({ code: '23505', message: 'unique violation' })).toBe(
      'That record already exists.'
    )
  })

  it('maps Postgres error code 23503', () => {
    expect(friendlyError({ code: '23503' })).toBe(
      'A linked record is missing. Refresh the page and try again.'
    )
  })

  it('maps Postgres error code 23514', () => {
    expect(friendlyError({ code: '23514' })).toBe(
      'Those values are not allowed. Please check the form.'
    )
  })

  it('maps Postgres error code 42501', () => {
    expect(friendlyError({ code: '42501' })).toBe('You do not have permission to do that.')
  })

  it('maps Postgres error code P0001', () => {
    expect(friendlyError({ code: 'P0001', message: 'Custom raise message' })).toBe(
      'Custom raise message'
    )
  })

  it('maps PGRST116', () => {
    expect(friendlyError({ code: 'PGRST116' })).toBe('No matching record was found.')
  })

  it('maps 23P01', () => {
    expect(friendlyError({ code: '23P01' })).toBe('That change conflicts with existing data.')
  })

  it('maps unique constraint for match votes', () => {
    expect(
      friendlyError({
        code: '23505',
        message: 'unique constraint match_votes_unique_player',
      })
    ).toBe('You have already voted for this match — change your vote instead.')
  })

  it('maps unique constraint for player contributions', () => {
    expect(
      friendlyError({
        code: '23505',
        details: 'player_contributions_unique_player',
      })
    ).toBe('This player already has a contribution for the match.')
  })

  it('maps unique constraint for payments', () => {
    expect(
      friendlyError({
        code: '23505',
        message: 'payments_unique_player violation',
      })
    ).toBe('This player already has a payment record for the match.')
  })

  it('maps unique constraint for profiles email', () => {
    expect(
      friendlyError({
        code: '23505',
        message: 'profiles_email_key',
      })
    ).toBe('Another member is already using that email address.')
  })

  it('maps invalid login credentials', () => {
    expect(friendlyError({ message: 'Invalid login credentials' })).toBe(
      'That email and password combination is not correct.'
    )
  })

  it('maps email not confirmed', () => {
    expect(friendlyError({ message: 'Email not confirmed' })).toBe(
      'Please confirm your email address first — check your inbox.'
    )
  })

  it('maps user already registered', () => {
    expect(friendlyError({ message: 'User already registered' })).toBe(
      'An account with that email already exists. Try signing in.'
    )
  })

  it('maps password too short', () => {
    expect(friendlyError({ message: 'Password should be at least 8 characters' })).toBe(
      'Your password must be at least 8 characters long.'
    )
  })

  it('maps security cooldown messages', () => {
    expect(
      friendlyError({
        message: 'For security purposes, you can only request this after 60 seconds',
      })
    ).toBe('Too many attempts. Please wait a moment and try again.')
  })

  it('maps rate limit messages', () => {
    expect(friendlyError({ message: 'Rate limit exceeded' })).toBe(
      'Too many attempts. Please wait a minute and try again.'
    )
  })

  it('maps network errors', () => {
    expect(friendlyError({ message: 'Failed to fetch' })).toBe(
      'Could not reach the server. Check your internet connection and try again.'
    )
  })

  it('maps RLS policy violations', () => {
    expect(
      friendlyError({
        message: 'new row violates row-level security policy for table "match_votes"',
      })
    ).toBe('You do not have permission to do that, or voting has already closed.')
  })

  it('handles error_description field', () => {
    expect(
      friendlyError({
        error_description: 'Invalid login credentials',
      })
    ).toBe('That email and password combination is not correct.')
  })

  it('returns raw message when no mapping matches', () => {
    expect(friendlyError({ message: 'Some unknown error' })).toBe('Some unknown error')
  })

  it('returns fallback for Error objects with no message', () => {
    expect(friendlyError({})).toBe('Something went wrong.')
  })
})

describe('isFinalizedGuard', () => {
  it('returns true for "already finalized" errors', () => {
    expect(
      isFinalizedGuard({
        message: 'Contributions for "Match" are already finalized. Confirm the change...',
      })
    ).toBe(true)
  })

  it('is case insensitive', () => {
    expect(isFinalizedGuard({ message: 'Already Finalized' })).toBe(true)
  })

  it('returns false for other errors', () => {
    expect(isFinalizedGuard({ message: 'Some other error' })).toBe(false)
  })

  it('returns false for null/undefined', () => {
    expect(isFinalizedGuard(null)).toBe(false)
    expect(isFinalizedGuard(undefined)).toBe(false)
  })

  it('returns false for errors without message', () => {
    expect(isFinalizedGuard({})).toBe(false)
  })
})
