import { useMemo } from 'react'
import {
  BadgeCheck,
  Ban,
  Calculator,
  Gift,
  HandCoins,
  History,
  IndianRupee,
  Lock,
  LockOpen,
  Pencil,
  RotateCcw,
} from 'lucide-react'
import type { AuditAction, ContributionAudit, Profile } from '../../lib/database.types'
import { formatCurrency, formatDateTime, toNumber } from '../../lib/format'
import { EmptyState, Skeleton } from '../ui/Misc'

const ACTION_META: Record<AuditAction, { label: string; icon: typeof History; tone: string }> = {
  recalculated: { label: 'Split recalculated', icon: Calculator, tone: 'text-sky-300' },
  manual_override: { label: 'Contribution adjusted', icon: Pencil, tone: 'text-amber-300' },
  override_cleared: { label: 'Adjustment removed', icon: RotateCcw, tone: 'text-coal-300' },
  exempted: { label: 'Player exempted', icon: Gift, tone: 'text-sky-300' },
  exemption_removed: { label: 'Exemption removed', icon: Gift, tone: 'text-coal-300' },
  payment_recorded: { label: 'Payment recorded', icon: HandCoins, tone: 'text-pitch-300' },
  expense_changed: { label: 'Total expense changed', icon: IndianRupee, tone: 'text-amber-300' },
  voting_closed: { label: 'Voting closed', icon: Lock, tone: 'text-coal-300' },
  voting_reopened: { label: 'Voting reopened', icon: LockOpen, tone: 'text-coal-300' },
  finalized: { label: 'Contributions finalized', icon: BadgeCheck, tone: 'text-pitch-300' },
  match_cancelled: { label: 'Match cancelled', icon: Ban, tone: 'text-rose-300' },
}

export function AuditTrail({
  entries,
  loading,
  players,
}: {
  entries: ContributionAudit[]
  loading: boolean
  players: Profile[]
}) {
  const nameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of players) map.set(p.id, p.full_name)
    return map
  }, [players])

  if (loading && entries.length === 0) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <EmptyState
        icon={<History className="h-5 w-5" />}
        title="Nothing recorded yet"
        description="Expense changes, manual adjustments, exemptions and payments all appear here with who made them and when."
      />
    )
  }

  return (
    <ol className="relative space-y-1 border-l border-coal-800 pl-5">
      {entries.map((entry) => {
        const meta = ACTION_META[entry.action] ?? {
          label: entry.action,
          icon: History,
          tone: 'text-coal-300',
        }
        const Icon = meta.icon

        return (
          <li key={entry.id} className="relative py-2.5">
            <span className="absolute -left-[26px] top-3.5 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-coal-900 ring-1 ring-coal-800">
              <Icon className={`h-3 w-3 ${meta.tone}`} />
            </span>

            <div className="flex flex-wrap items-baseline gap-x-2">
              <p className="text-sm font-semibold text-coal-100">{meta.label}</p>
              {entry.player_id && (
                <p className="text-sm text-coal-400">
                  · {nameById.get(entry.player_id) ?? 'a player'}
                </p>
              )}
            </div>

            <p className="mt-0.5 text-xs text-coal-500">
              {formatDateTime(entry.created_at)}
              {entry.changed_by && <> · by {nameById.get(entry.changed_by) ?? 'an admin'}</>}
            </p>

            <AuditDetail entry={entry} />

            {entry.reason && (
              <p className="mt-1 rounded-lg bg-coal-900/70 px-2.5 py-1.5 text-xs italic text-coal-400">
                “{entry.reason}”
              </p>
            )}
          </li>
        )
      })}
    </ol>
  )
}

/** Renders the most useful before/after figures for each action type. */
function AuditDetail({ entry }: { entry: ContributionAudit }) {
  const oldValue = entry.old_value as Record<string, unknown> | null
  const newValue = entry.new_value as Record<string, unknown> | null

  const pairs: Array<[string, string]> = []

  if (entry.action === 'expense_changed') {
    pairs.push([
      'Total',
      `${formatCurrency(toNumber(oldValue?.total_expense as number))} → ${formatCurrency(
        toNumber(newValue?.total_expense as number)
      )}`,
    ])
  }

  if (entry.action === 'manual_override' || entry.action === 'override_cleared') {
    const from = oldValue?.amount_due
    const to = newValue?.amount_due
    pairs.push([
      'Amount',
      to != null
        ? `${formatCurrency(toNumber(from as number))} → ${formatCurrency(toNumber(to as number))}`
        : `was ${formatCurrency(toNumber(from as number))}`,
    ])
  }

  if (entry.action === 'payment_recorded') {
    pairs.push([
      'Paid',
      `${formatCurrency(toNumber(oldValue?.amount_paid as number))} → ${formatCurrency(
        toNumber(newValue?.amount_paid as number)
      )}`,
    ])
    if (newValue?.status) pairs.push(['Status', String(newValue.status).replace('_', ' ')])
  }

  if (entry.action === 'recalculated' || entry.action === 'finalized') {
    const total = newValue?.total_expense ?? newValue?.['total_expense']
    if (total != null) pairs.push(['Total', formatCurrency(toNumber(total as number))])
    const perPlayer = newValue?.per_player
    if (perPlayer != null) pairs.push(['Per player', formatCurrency(toNumber(perPlayer as number))])
    const splitBetween = newValue?.split_between
    if (splitBetween != null) pairs.push(['Players', String(splitBetween)])
    if (newValue?.forced === true) pairs.push(['Note', 'Re-split after finalization'])
  }

  if (pairs.length === 0) return null

  return (
    <dl className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
      {pairs.map(([label, value]) => (
        <div key={label} className="flex items-baseline gap-1.5">
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-coal-600">
            {label}
          </dt>
          <dd className="text-xs font-medium tabular-nums text-coal-300">{value}</dd>
        </div>
      ))}
    </dl>
  )
}
