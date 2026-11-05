import { describe, it, expect } from 'vitest'
import {
  formatCurrency,
  formatCurrencyShort,
  toNumber,
  round2,
  matchDateTime,
  matchHasStarted,
  formatMatchDate,
  formatMatchDateShort,
  formatMatchTime,
  formatMatchWhen,
  formatRelative,
  formatDateTime,
  toDateInput,
  toDateTimeInput,
  fromDateTimeInput,
  initials,
  pluralise,
  avatarTint,
} from './format'

describe('formatCurrency', () => {
  it('formats Indian Rupees with 2 decimals', () => {
    expect(formatCurrency(3000)).toMatch(/₹.*3,000\.00/)
  })

  it('handles string numbers', () => {
    expect(formatCurrency('500.75')).toMatch(/₹.*500\.75/)
  })

  it('handles null and undefined as 0', () => {
    expect(formatCurrency(null)).toMatch(/₹.*0\.00/)
    expect(formatCurrency(undefined)).toMatch(/₹.*0\.00/)
  })

  it('handles NaN as 0', () => {
    expect(formatCurrency(NaN)).toMatch(/₹.*0\.00/)
  })

  it('handles empty string as 0', () => {
    expect(formatCurrency('')).toMatch(/₹.*0\.00/)
  })

  it('always renders 2 decimal places', () => {
    const result = formatCurrency(100)
    expect(result).toMatch(/\.00/)
  })

  it('uses Indian number format with lakhs', () => {
    const result = formatCurrency(100000)
    // Indian format uses lakhs separator
    expect(result).toContain('1,00,000')
  })
})

describe('formatCurrencyShort', () => {
  it('formats integers without decimals', () => {
    const result = formatCurrencyShort(3000)
    expect(result).toMatch(/₹.*3,000/)
    expect(result).not.toContain('.00')
  })

  it('shows decimals for non-integers', () => {
    expect(formatCurrencyShort(3000.5)).toMatch(/₹.*3,000\.50/)
  })

  it('handles string numbers', () => {
    expect(formatCurrencyShort('1000')).toMatch(/₹.*1,000/)
  })

  it('handles null and undefined', () => {
    expect(formatCurrencyShort(null)).toMatch(/₹.*0/)
    expect(formatCurrencyShort(undefined)).toMatch(/₹.*0/)
  })
})

describe('toNumber', () => {
  it('returns numbers as-is', () => {
    expect(toNumber(42)).toBe(42)
    expect(toNumber(3.14)).toBe(3.14)
  })

  it('parses string numbers', () => {
    expect(toNumber('123')).toBe(123)
    expect(toNumber('45.67')).toBe(45.67)
  })

  it('returns 0 for null/undefined/empty', () => {
    expect(toNumber(null)).toBe(0)
    expect(toNumber(undefined)).toBe(0)
    expect(toNumber('')).toBe(0)
  })

  it('returns 0 for NaN', () => {
    expect(toNumber(NaN)).toBe(0)
  })

  it('returns 0 for unparseable strings', () => {
    expect(toNumber('not-a-number')).toBe(0)
  })

  it('handles Infinity as 0', () => {
    expect(toNumber(Infinity)).toBe(0)
    expect(toNumber(-Infinity)).toBe(0)
  })
})

describe('round2', () => {
  it('rounds to 2 decimal places', () => {
    expect(round2(1.234)).toBe(1.23)
    expect(round2(1.236)).toBe(1.24)
  })

  it('handles integers', () => {
    expect(round2(5)).toBe(5)
  })

  it('handles values already at 2dp', () => {
    expect(round2(3.14)).toBe(3.14)
  })

  it('avoids floating point surprises', () => {
    expect(round2(0.1 + 0.2)).toBe(0.3)
  })

  it('handles negative numbers', () => {
    expect(round2(-1.236)).toBe(-1.24)
  })
})

describe('matchDateTime', () => {
  it('combines date and time strings', () => {
    const result = matchDateTime('2026-11-15', '07:30:00')
    expect(result).toBeInstanceOf(Date)
    expect(result.getHours()).toBe(7)
    expect(result.getMinutes()).toBe(30)
  })

  it('handles time without seconds', () => {
    const result = matchDateTime('2026-11-15', '07:30')
    expect(result).toBeInstanceOf(Date)
    expect(result.getHours()).toBe(7)
    expect(result.getMinutes()).toBe(30)
  })

  it('handles midnight', () => {
    const result = matchDateTime('2026-11-15', '00:00:00')
    expect(result.getHours()).toBe(0)
    expect(result.getMinutes()).toBe(0)
  })

  it('handles empty time as midnight', () => {
    const result = matchDateTime('2026-11-15', '')
    expect(result.getHours()).toBe(0)
    expect(result.getMinutes()).toBe(0)
  })

  it('pads single-digit hours and minutes', () => {
    const result = matchDateTime('2026-11-15', '7:5:0')
    expect(result.getHours()).toBe(7)
    expect(result.getMinutes()).toBe(5)
  })
})

describe('matchHasStarted', () => {
  it('returns true for past matches', () => {
    const result = matchHasStarted('2020-01-01', '10:00:00')
    expect(result).toBe(true)
  })

  it('returns false for future matches', () => {
    const result = matchHasStarted('2099-12-31', '23:59:00')
    expect(result).toBe(false)
  })
})

describe('formatMatchDate', () => {
  it('formats date as "EEE, d MMM yyyy"', () => {
    const result = formatMatchDate('2026-11-15')
    expect(result).toMatch(/\w{3}, \d{1,2} \w{3} 2026/)
  })
})

describe('formatMatchDateShort', () => {
  it('formats date as "d MMM"', () => {
    const result = formatMatchDateShort('2026-11-15')
    expect(result).toMatch(/\d{1,2} \w{3}/)
  })
})

describe('formatMatchTime', () => {
  it('formats time as "h:mm a"', () => {
    expect(formatMatchTime('07:30:00')).toMatch(/7:30 AM/)
  })

  it('handles PM times', () => {
    expect(formatMatchTime('19:30:00')).toMatch(/7:30 PM/)
  })

  it('handles noon', () => {
    expect(formatMatchTime('12:00:00')).toMatch(/12:00 PM/)
  })

  it('handles midnight', () => {
    expect(formatMatchTime('00:00:00')).toMatch(/12:00 AM/)
  })
})

describe('formatMatchWhen', () => {
  it('combines date and time with separator', () => {
    const result = formatMatchWhen('2026-11-15', '07:30:00')
    expect(result).toContain('·')
    expect(result).toMatch(/\w{3}, \d{1,2} \w{3} 2026/)
    expect(result).toMatch(/\d{1,2}:\d{2} [AP]M/)
  })
})

describe('formatRelative', () => {
  it('returns "—" for null', () => {
    expect(formatRelative(null)).toBe('—')
  })

  it('returns "—" for undefined', () => {
    expect(formatRelative(undefined)).toBe('—')
  })

  it('formats past dates with "ago"', () => {
    const pastDate = new Date(Date.now() - 3600000).toISOString()
    const result = formatRelative(pastDate)
    expect(result).toContain('ago')
  })

  it('formats future dates with "in"', () => {
    const futureDate = new Date(Date.now() + 3600000).toISOString()
    const result = formatRelative(futureDate)
    expect(result).toMatch(/^in /)
  })
})

describe('formatDateTime', () => {
  it('returns "—" for null', () => {
    expect(formatDateTime(null)).toBe('—')
  })

  it('returns "—" for undefined', () => {
    expect(formatDateTime(undefined)).toBe('—')
  })

  it('formats ISO date as "d MMM yyyy, h:mm a"', () => {
    const result = formatDateTime('2026-11-12T21:14:00Z')
    expect(result).toMatch(/\d{1,2} \w{3} 2026, \d{1,2}:\d{2} [AP]M/)
  })
})

describe('toDateInput', () => {
  it('formats Date as yyyy-MM-dd', () => {
    const date = new Date('2026-11-15T10:30:00')
    const result = toDateInput(date)
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('toDateTimeInput', () => {
  it('returns empty string for null', () => {
    expect(toDateTimeInput(null)).toBe('')
  })

  it('returns empty string for undefined', () => {
    expect(toDateTimeInput(undefined)).toBe('')
  })

  it('formats ISO as yyyy-MM-ddTHH:mm', () => {
    const result = toDateTimeInput('2026-11-12T21:14:00Z')
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
  })
})

describe('fromDateTimeInput', () => {
  it('returns null for empty string', () => {
    expect(fromDateTimeInput('')).toBe(null)
  })

  it('converts datetime-local to ISO string', () => {
    const result = fromDateTimeInput('2026-11-15T10:30')
    expect(result).toBeTruthy()
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('returns null for invalid dates', () => {
    expect(fromDateTimeInput('not-a-date')).toBe(null)
  })
})

describe('initials', () => {
  it('returns first letter of each word (max 2)', () => {
    expect(initials('Amit Bhargav')).toBe('AB')
  })

  it('handles single names', () => {
    expect(initials('Virat')).toBe('V')
  })

  it('handles more than 2 words', () => {
    expect(initials('John Paul Jones')).toBe('JP')
  })

  it('returns "?" for null', () => {
    expect(initials(null)).toBe('?')
  })

  it('returns "?" for undefined', () => {
    expect(initials(undefined)).toBe('?')
  })

  it('returns "?" for empty string', () => {
    expect(initials('')).toBe('?')
  })

  it('handles multiple spaces', () => {
    expect(initials('John   Doe')).toBe('JD')
  })

  it('uppercases letters', () => {
    expect(initials('amit bhargav')).toBe('AB')
  })

  it('handles names with leading/trailing spaces', () => {
    expect(initials('  John Doe  ')).toBe('JD')
  })
})

describe('pluralise', () => {
  it('uses singular for count=1', () => {
    expect(pluralise(1, 'player')).toBe('1 player')
  })

  it('uses plural for count=0', () => {
    expect(pluralise(0, 'player')).toBe('0 players')
  })

  it('uses plural for count>1', () => {
    expect(pluralise(5, 'player')).toBe('5 players')
  })

  it('uses custom plural when provided', () => {
    expect(pluralise(2, 'person', 'people')).toBe('2 people')
  })

  it('handles irregular plurals', () => {
    expect(pluralise(3, 'child', 'children')).toBe('3 children')
  })
})

describe('avatarTint', () => {
  it('returns a consistent tint for the same ID', () => {
    const id = 'abc-123'
    const result1 = avatarTint(id)
    const result2 = avatarTint(id)
    expect(result1).toBe(result2)
  })

  it('returns one of the predefined tints', () => {
    const tints = [
      'bg-pitch-600/25 text-pitch-200 ring-pitch-500/30',
      'bg-sky-600/25 text-sky-200 ring-sky-500/30',
      'bg-amber-600/25 text-amber-200 ring-amber-500/30',
      'bg-violet-600/25 text-violet-200 ring-violet-500/30',
      'bg-rose-600/25 text-rose-200 ring-rose-500/30',
      'bg-teal-600/25 text-teal-200 ring-teal-500/30',
    ]
    const result = avatarTint('test-id')
    expect(tints).toContain(result)
  })

  it('distributes different IDs across tints', () => {
    const results = new Set()
    for (let i = 0; i < 20; i++) {
      results.add(avatarTint(`id-${i}`))
    }
    // Should get at least 3 different tints from 20 IDs
    expect(results.size).toBeGreaterThanOrEqual(3)
  })
})
