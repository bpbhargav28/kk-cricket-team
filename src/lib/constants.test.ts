import { describe, it, expect } from 'vitest'
import {
  VOTE_OPTIONS,
  VOTE_STYLES,
  EXPENSE_CATEGORIES,
  PAYMENT_STATUS_STYLES,
  MATCH_STATUS_STYLES,
} from './constants'
import type {
  VoteValue,
  ExpenseCategory,
  PaymentStatus,
  MatchStatus,
} from './database.types'

describe('VOTE_OPTIONS', () => {
  it('covers all VoteValue union members', () => {
    const expectedValues: VoteValue[] = ['yes', 'no', 'maybe']
    const actualValues = VOTE_OPTIONS.map((o) => o.value)

    expect(actualValues).toHaveLength(expectedValues.length)
    for (const value of expectedValues) {
      expect(actualValues).toContain(value)
    }
  })

  it('has unique values', () => {
    const values = VOTE_OPTIONS.map((o) => o.value)
    expect(new Set(values).size).toBe(values.length)
  })
})

describe('VOTE_STYLES', () => {
  it('has entries for all VoteValue union members', () => {
    const expectedKeys: VoteValue[] = ['yes', 'no', 'maybe']

    for (const key of expectedKeys) {
      expect(VOTE_STYLES).toHaveProperty(key)
      expect(VOTE_STYLES[key]).toHaveProperty('chip')
      expect(VOTE_STYLES[key]).toHaveProperty('active')
      expect(VOTE_STYLES[key]).toHaveProperty('dot')
      expect(VOTE_STYLES[key]).toHaveProperty('text')
      expect(VOTE_STYLES[key]).toHaveProperty('label')
    }
  })

  it('has exactly the expected number of keys', () => {
    expect(Object.keys(VOTE_STYLES)).toHaveLength(3)
  })
})

describe('EXPENSE_CATEGORIES', () => {
  it('covers all ExpenseCategory union members', () => {
    const expectedValues: ExpenseCategory[] = [
      'ground',
      'ball',
      'kit',
      'refreshments',
      'umpire',
      'travel',
      'other',
    ]
    const actualValues = EXPENSE_CATEGORIES.map((c) => c.value)

    expect(actualValues).toHaveLength(expectedValues.length)
    for (const value of expectedValues) {
      expect(actualValues).toContain(value)
    }
  })

  it('has unique values', () => {
    const values = EXPENSE_CATEGORIES.map((c) => c.value)
    expect(new Set(values).size).toBe(values.length)
  })
})

describe('PAYMENT_STATUS_STYLES', () => {
  it('has entries for all PaymentStatus union members', () => {
    const expectedKeys: PaymentStatus[] = ['pending', 'partially_paid', 'paid']

    for (const key of expectedKeys) {
      expect(PAYMENT_STATUS_STYLES).toHaveProperty(key)
      expect(PAYMENT_STATUS_STYLES[key]).toHaveProperty('label')
      expect(PAYMENT_STATUS_STYLES[key]).toHaveProperty('className')
    }
  })

  it('has exactly the expected number of keys', () => {
    expect(Object.keys(PAYMENT_STATUS_STYLES)).toHaveLength(3)
  })
})

describe('MATCH_STATUS_STYLES', () => {
  it('has entries for all MatchStatus union members', () => {
    const expectedKeys: MatchStatus[] = ['upcoming', 'completed', 'cancelled']

    for (const key of expectedKeys) {
      expect(MATCH_STATUS_STYLES).toHaveProperty(key)
      expect(MATCH_STATUS_STYLES[key]).toHaveProperty('label')
      expect(MATCH_STATUS_STYLES[key]).toHaveProperty('className')
    }
  })

  it('has exactly the expected number of keys', () => {
    expect(Object.keys(MATCH_STATUS_STYLES)).toHaveLength(3)
  })
})
