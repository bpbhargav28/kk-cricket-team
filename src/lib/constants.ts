import type { ExpenseCategory, PaymentMethod, VoteValue } from './database.types'

export const APP_NAME = 'KK CRICKET TEAM'
export const APP_TAGLINE = 'Matches · Attendance · Expenses'

export const VOTE_OPTIONS: Array<{
  value: VoteValue
  label: string
  short: string
  description: string
}> = [
  { value: 'yes', label: 'Yes — Available', short: 'Yes', description: "I'm playing" },
  { value: 'no', label: 'No — Not Available', short: 'No', description: "I can't make it" },
  { value: 'maybe', label: 'Maybe — Not Sure', short: 'Maybe', description: "I'll confirm later" },
]

export const VOTE_STYLES: Record<
  VoteValue,
  { chip: string; active: string; dot: string; text: string; label: string }
> = {
  yes: {
    chip: 'border-pitch-600/40 bg-pitch-950/40 text-pitch-200 hover:border-pitch-500 hover:bg-pitch-900/40',
    active: 'border-pitch-400 bg-pitch-600 text-white shadow-glow',
    dot: 'bg-pitch-400',
    text: 'text-pitch-300',
    label: 'Available',
  },
  no: {
    chip: 'border-rose-900/50 bg-rose-950/30 text-rose-200 hover:border-rose-600 hover:bg-rose-900/30',
    active: 'border-rose-400 bg-rose-600 text-white shadow-[0_8px_32px_-8px_rgba(244,63,94,0.5)]',
    dot: 'bg-rose-400',
    text: 'text-rose-300',
    label: 'Not available',
  },
  maybe: {
    chip: 'border-amber-900/50 bg-amber-950/30 text-amber-200 hover:border-amber-600 hover:bg-amber-900/30',
    active: 'border-amber-300 bg-amber-500 text-coal-950 shadow-[0_8px_32px_-8px_rgba(245,158,11,0.5)]',
    dot: 'bg-amber-400',
    text: 'text-amber-300',
    label: 'Not sure',
  },
}

export const EXPENSE_CATEGORIES: Array<{ value: ExpenseCategory; label: string }> = [
  { value: 'ground', label: 'Ground booking' },
  { value: 'ball', label: 'Cricket balls' },
  { value: 'kit', label: 'Kit & equipment' },
  { value: 'refreshments', label: 'Refreshments' },
  { value: 'umpire', label: 'Umpire fee' },
  { value: 'travel', label: 'Travel' },
  { value: 'other', label: 'Other' },
]

export const PAYMENT_METHODS: Array<{ value: PaymentMethod; label: string }> = [
  { value: 'upi', label: 'UPI' },
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'other', label: 'Other' },
]

export const PAYMENT_STATUS_STYLES = {
  paid: { label: 'Paid', className: 'bg-pitch-600/20 text-pitch-300 ring-pitch-600/40' },
  partially_paid: {
    label: 'Partially paid',
    className: 'bg-amber-500/20 text-amber-300 ring-amber-500/40',
  },
  pending: { label: 'Pending', className: 'bg-rose-600/20 text-rose-300 ring-rose-600/40' },
} as const

export const MATCH_STATUS_STYLES = {
  upcoming: { label: 'Upcoming', className: 'bg-pitch-600/20 text-pitch-300 ring-pitch-600/40' },
  completed: { label: 'Completed', className: 'bg-coal-700/60 text-coal-300 ring-coal-600/50' },
  cancelled: { label: 'Cancelled', className: 'bg-rose-600/20 text-rose-300 ring-rose-600/40' },
} as const

/** Demo tooling is only ever reachable when this is explicitly switched on. */
export const DEMO_MODE =
  import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEMO_DATA === 'true'
