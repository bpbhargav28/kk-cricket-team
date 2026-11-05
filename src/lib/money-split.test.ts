import { describe, it, expect } from 'vitest'

/**
 * Test-only helper that mirrors the Postgres money-split algorithm from
 * `public.recalculate_match_contributions` in supabase/migrations/20260101000200_functions.sql.
 *
 * The authoritative implementation is the SQL function. This mirrors its arithmetic
 * to guard the contract:
 *   - Integer paise arithmetic (no floating point)
 *   - base = pool / n (integer division, floor)
 *   - remainder = pool % n (0 to n-1 paise left over)
 *   - remainder distributed one paisa each by `order by lower(full_name), player_id`
 */
function splitMoneyInPaise(totalPaise: bigint, playerCount: number): bigint[] {
  if (playerCount === 0) return []

  const base = totalPaise / BigInt(playerCount)
  const remainder = Number(totalPaise % BigInt(playerCount))

  const shares: bigint[] = []
  for (let i = 0; i < playerCount; i++) {
    // First `remainder` players get one extra paisa
    shares.push(base + (i < remainder ? 1n : 0n))
  }

  return shares
}

describe('money-split algorithm', () => {
  it('divides evenly when total is divisible by player count', () => {
    const shares = splitMoneyInPaise(3000n, 15) // ₹30.00 / 15 = ₹2.00 each
    expect(shares).toHaveLength(15)
    expect(shares.every((s) => s === 200n)).toBe(true)
    expect(shares.reduce((sum, s) => sum + s, 0n)).toBe(3000n)
  })

  it('distributes remainder correctly (3000 paise / 15 players)', () => {
    const shares = splitMoneyInPaise(3000n, 15)
    const uniqueValues = new Set(shares)

    // All shares should be equal (3000 / 15 = 200 exactly)
    expect(uniqueValues.size).toBe(1)
    expect(uniqueValues.has(200n)).toBe(true)
  })

  it('handles odd amounts with remainder (1000 paise / 3 players)', () => {
    const shares = splitMoneyInPaise(1000n, 3) // 1000 / 3 = 333 base, 1 remainder
    const sorted = [...shares].sort((a, b) => Number(a - b))

    // Two players get 333, one gets 334
    expect(sorted[0]).toBe(333n)
    expect(sorted[1]).toBe(333n)
    expect(sorted[2]).toBe(334n)

    // Sum equals total
    expect(shares.reduce((sum, s) => sum + s, 0n)).toBe(1000n)

    // Every share differs by at most one paisa
    const max = Math.max(...shares.map(Number))
    const min = Math.min(...shares.map(Number))
    expect(max - min).toBeLessThanOrEqual(1)
  })

  it('handles 1 paisa / 7 players', () => {
    const shares = splitMoneyInPaise(1n, 7)
    expect(shares).toHaveLength(7)

    // One player gets 1 paisa, six get 0
    const sum = shares.reduce((s, v) => s + v, 0n)
    expect(sum).toBe(1n)

    const nonZero = shares.filter((s) => s > 0n)
    expect(nonZero).toHaveLength(1)
    expect(nonZero[0]).toBe(1n)
  })

  it('handles 0 players', () => {
    const shares = splitMoneyInPaise(1000n, 0)
    expect(shares).toHaveLength(0)
  })

  it('handles 0 total expense', () => {
    const shares = splitMoneyInPaise(0n, 5)
    expect(shares).toHaveLength(5)
    expect(shares.every((s) => s === 0n)).toBe(true)
  })

  it('handles 1 player', () => {
    const shares = splitMoneyInPaise(1000n, 1)
    expect(shares).toHaveLength(1)
    expect(shares[0]).toBe(1000n)
  })

  it('property: sum of shares equals total exactly', () => {
    const testCases = [
      [3000n, 15],
      [1000n, 3],
      [10000n, 7],
      [1n, 10],
      [99999n, 13],
      [50000n, 4],
      [123456n, 17],
    ] as const

    for (const [total, count] of testCases) {
      const shares = splitMoneyInPaise(total, count)
      const sum = shares.reduce((s, v) => s + v, 0n)
      expect(sum).toBe(total)
    }
  })

  it('property: every share differs by at most one paisa', () => {
    const testCases = [
      [3000n, 15],
      [1000n, 3],
      [10000n, 7],
      [1n, 10],
      [99999n, 13],
      [50000n, 4],
      [123456n, 17],
      [1000n, 13],
      [7777n, 23],
    ] as const

    for (const [total, count] of testCases) {
      const shares = splitMoneyInPaise(total, count)
      if (shares.length === 0) continue

      const max = Math.max(...shares.map(Number))
      const min = Math.min(...shares.map(Number))
      expect(max - min).toBeLessThanOrEqual(1)
    }
  })

  it('property: no share is negative', () => {
    const testCases = [
      [3000n, 15],
      [1000n, 3],
      [1n, 7],
      [0n, 5],
      [99999n, 13],
    ] as const

    for (const [total, count] of testCases) {
      const shares = splitMoneyInPaise(total, count)
      expect(shares.every((s) => s >= 0n)).toBe(true)
    }
  })

  it('property: at most (playerCount - 1) players get the higher amount', () => {
    const testCases = [
      [1000n, 3], // 1000 % 3 = 1, so 1 player gets +1
      [10000n, 7], // 10000 % 7 = 4, so 4 players get +1
      [12345n, 17], // 12345 % 17 = 6, so 6 players get +1
    ] as const

    for (const [total, count] of testCases) {
      const shares = splitMoneyInPaise(total, count)
      const base = total / BigInt(count)
      const remainder = Number(total % BigInt(count))

      const higherCount = shares.filter((s) => s === base + 1n).length
      const lowerCount = shares.filter((s) => s === base).length

      expect(higherCount).toBe(remainder)
      expect(lowerCount).toBe(count - remainder)
    }
  })

  it('handles large amounts (₹1,00,000 / 23 players)', () => {
    const shares = splitMoneyInPaise(10000000n, 23) // ₹1,00,000.00
    expect(shares).toHaveLength(23)

    const sum = shares.reduce((s, v) => s + v, 0n)
    expect(sum).toBe(10000000n)

    const max = Math.max(...shares.map(Number))
    const min = Math.min(...shares.map(Number))
    expect(max - min).toBeLessThanOrEqual(1)
  })

  it('handles many players with small total', () => {
    const shares = splitMoneyInPaise(5n, 20) // 5 paise / 20 players
    expect(shares).toHaveLength(20)

    const sum = shares.reduce((s, v) => s + v, 0n)
    expect(sum).toBe(5n)

    // 5 players get 1 paisa, 15 get 0
    const nonZero = shares.filter((s) => s > 0n)
    expect(nonZero).toHaveLength(5)
  })
})
