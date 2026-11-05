import { format, formatDistanceToNowStrict, isPast, parseISO } from 'date-fns'

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const inrCompact = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

/** ₹3,000.00 — always two decimals, as required for contribution amounts. */
export function formatCurrency(value: number | string | null | undefined): string {
  const n = toNumber(value)
  return inr.format(n)
}

/** ₹3,000 — for headline figures where paise would be noise. */
export function formatCurrencyShort(value: number | string | null | undefined): string {
  const n = toNumber(value)
  return Number.isInteger(n) ? inrCompact.format(n) : inr.format(n)
}

/** Supabase returns `numeric` columns as strings in some code paths. */
export function toNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0
  const n = typeof value === 'number' ? value : Number.parseFloat(value)
  return Number.isFinite(n) ? n : 0
}

/** Round half-up to 2 dp without floating-point surprises. */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

/**
 * Combine a `date` column ("2026-11-15") and a `time` column ("07:30:00" or
 * "07:30") into a Date in the viewer's local timezone.
 */
export function matchDateTime(matchDate: string, matchTime: string): Date {
  const [h = '0', m = '0', s = '0'] = (matchTime || '00:00:00').split(':')
  const pad = (v: string) => v.padStart(2, '0')
  return new Date(`${matchDate}T${pad(h)}:${pad(m)}:${pad(s)}`)
}

/** Has the match already started (with a small grace period)? */
export function matchHasStarted(matchDate: string, matchTime: string): boolean {
  return matchDateTime(matchDate, matchTime).getTime() <= Date.now()
}

/** "Sun, 15 Nov 2026" */
export function formatMatchDate(matchDate: string): string {
  return format(parseISO(matchDate), 'EEE, d MMM yyyy')
}

/** "15 Nov" */
export function formatMatchDateShort(matchDate: string): string {
  return format(parseISO(matchDate), 'd MMM')
}

/** "7:30 AM" */
export function formatMatchTime(matchTime: string): string {
  const [h, m] = matchTime.split(':')
  const d = new Date()
  d.setHours(Number(h), Number(m), 0, 0)
  return format(d, 'h:mm a')
}

/** "Sun, 15 Nov 2026 · 7:30 AM" */
export function formatMatchWhen(matchDate: string, matchTime: string): string {
  return `${formatMatchDate(matchDate)} · ${formatMatchTime(matchTime)}`
}

/** "in 3 days" / "2 hours ago" */
export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return '—'
  const date = parseISO(iso)
  const distance = formatDistanceToNowStrict(date)
  return isPast(date) ? `${distance} ago` : `in ${distance}`
}

/** "12 Nov 2026, 9:14 PM" */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  return format(parseISO(iso), 'd MMM yyyy, h:mm a')
}

/** For <input type="date"> values. */
export function toDateInput(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

/** For <input type="datetime-local"> values. */
export function toDateTimeInput(iso: string | null | undefined): string {
  if (!iso) return ''
  return format(parseISO(iso), "yyyy-MM-dd'T'HH:mm")
}

/** datetime-local string → ISO 8601 with offset, or null. */
export function fromDateTimeInput(value: string): string | null {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

/** "AB" from "Amit Bhargav" — for avatar fallbacks. */
export function initials(name: string | null | undefined): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?'
}

export function pluralise(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`
}

/** Deterministic pastel-ish accent per player, used for avatar backgrounds. */
export function avatarTint(id: string): string {
  const tints = [
    'bg-pitch-600/25 text-pitch-200 ring-pitch-500/30',
    'bg-sky-600/25 text-sky-200 ring-sky-500/30',
    'bg-amber-600/25 text-amber-200 ring-amber-500/30',
    'bg-violet-600/25 text-violet-200 ring-violet-500/30',
    'bg-rose-600/25 text-rose-200 ring-rose-500/30',
    'bg-teal-600/25 text-teal-200 ring-teal-500/30',
  ]
  let hash = 0
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  return tints[hash % tints.length]
}
