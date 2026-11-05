import { useMemo, useState } from 'react'
import {
  BadgeCheck,
  Calculator,
  Gift,
  IndianRupee,
  Pencil,
  RotateCcw,
  TriangleAlert,
  Users,
} from 'lucide-react'
import type {
  ContributionWithPlayer,
  Match,
  MatchExpense,
  PaymentWithPlayer,
} from '../../lib/database.types'
import { cn } from '../../lib/cn'
import { EXPENSE_CATEGORIES } from '../../lib/constants'
import { formatCurrency, formatCurrencyShort, round2, toNumber } from '../../lib/format'
import { Alert, Avatar, Badge, EmptyState } from '../ui/Misc'
import { Button } from '../ui/Button'
import { Input, Textarea } from '../ui/Field'
import { Modal } from '../ui/Modal'

interface ExpenseBreakdownProps {
  match: Match
  contributions: ContributionWithPlayer[]
  expenseItems: MatchExpense[]
  payments: PaymentWithPlayer[]
  isAdmin: boolean
  currentPlayerId: string
  onSetManual: (playerId: string, amount: number, reason: string) => Promise<void>
  onClearManual: (playerId: string) => Promise<void>
  onToggleExempt: (playerId: string, exempt: boolean, reason?: string) => Promise<void>
  onRecalculate: () => Promise<void>
}

export function ExpenseBreakdown({
  match,
  contributions,
  expenseItems,
  payments,
  isAdmin,
  currentPlayerId,
  onSetManual,
  onClearManual,
  onToggleExempt,
  onRecalculate,
}: ExpenseBreakdownProps) {
  const [editing, setEditing] = useState<ContributionWithPlayer | null>(null)
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [amountError, setAmountError] = useState<string | undefined>()

  const paidByPlayer = useMemo(() => {
    const map = new Map<string, number>()
    for (const p of payments) map.set(p.player_id, toNumber(p.amount_paid))
    return map
  }, [payments])

  const stats = useMemo(() => {
    const total = toNumber(match.total_expense)
    const assigned = contributions.reduce((sum, c) => sum + toNumber(c.amount_due), 0)
    const splitPool = contributions.filter((c) => !c.is_exempt && !c.is_manual_override)
    const exempt = contributions.filter((c) => c.is_exempt)
    const manual = contributions.filter((c) => c.is_manual_override && !c.is_exempt)
    const fixedTotal = manual.reduce((sum, c) => sum + toNumber(c.amount_due), 0)
    const perPlayer =
      splitPool.length > 0 ? round2((total - fixedTotal) / splitPool.length) : 0

    return {
      total,
      assigned: round2(assigned),
      unallocated: round2(total - assigned),
      splitCount: splitPool.length,
      exemptCount: exempt.length,
      manualCount: manual.length,
      perPlayer,
      contributorCount: contributions.length,
    }
  }, [match.total_expense, contributions])

  const itemsTotal = expenseItems.reduce((sum, i) => sum + toNumber(i.amount), 0)

  const sorted = useMemo(
    () =>
      [...contributions].sort((a, b) =>
        (a.player?.full_name ?? '').localeCompare(b.player?.full_name ?? '')
      ),
    [contributions]
  )

  function openEditor(contribution: ContributionWithPlayer) {
    setEditing(contribution)
    setAmount(toNumber(contribution.amount_due).toFixed(2))
    setReason(contribution.override_reason ?? '')
    setAmountError(undefined)
  }

  async function saveManual() {
    if (!editing) return
    const parsed = Number.parseFloat(amount)
    if (!Number.isFinite(parsed) || parsed < 0) {
      setAmountError('Enter an amount of ₹0 or more.')
      return
    }
    if (parsed > stats.total) {
      setAmountError(`That is more than the total match expense (${formatCurrency(stats.total)}).`)
      return
    }

    setSaving(true)
    try {
      await onSetManual(editing.player_id, round2(parsed), reason.trim())
      setEditing(null)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* ------------------------------- Formula ------------------------- */}
      <div className="rounded-xl border border-coal-800 bg-coal-925/80 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Calculator className="h-4 w-4 text-pitch-400" />
            <h3 className="section-title">Expense split</h3>
          </div>
          {isAdmin && (
            <Button
              size="sm"
              variant="secondary"
              icon={<RotateCcw className="h-3.5 w-3.5" />}
              onClick={() => void onRecalculate()}
            >
              Recalculate
            </Button>
          )}
        </div>

        <p className="mt-3 font-mono text-sm leading-relaxed text-coal-300">
          <span className="text-coal-500">Each player =</span>{' '}
          <span className="font-semibold text-white">{formatCurrencyShort(stats.total)}</span>
          {stats.manualCount > 0 && (
            <>
              {' '}
              <span className="text-coal-500">−</span>{' '}
              <span className="text-amber-300" title="Manually adjusted contributions">
                {formatCurrencyShort(
                  round2(
                    contributions
                      .filter((c) => c.is_manual_override && !c.is_exempt)
                      .reduce((s, c) => s + toNumber(c.amount_due), 0)
                  )
                )}
              </span>
            </>
          )}{' '}
          <span className="text-coal-500">÷</span>{' '}
          <span className="font-semibold text-white">{stats.splitCount}</span>{' '}
          <span className="text-coal-500">=</span>{' '}
          <span className="font-semibold text-pitch-300">{formatCurrency(stats.perPlayer)}</span>
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniStat
            icon={<IndianRupee className="h-3.5 w-3.5" />}
            label="Total expense"
            value={formatCurrencyShort(stats.total)}
          />
          <MiniStat
            icon={<Users className="h-3.5 w-3.5" />}
            label="Splitting between"
            value={String(stats.splitCount)}
          />
          <MiniStat
            icon={<BadgeCheck className="h-3.5 w-3.5" />}
            label="Per player"
            value={formatCurrency(stats.perPlayer)}
            tone="green"
          />
          <MiniStat
            icon={<Calculator className="h-3.5 w-3.5" />}
            label="Allocated"
            value={formatCurrencyShort(stats.assigned)}
            tone={Math.abs(stats.unallocated) < 0.005 ? 'green' : 'amber'}
          />
        </div>

        {Math.abs(stats.unallocated) >= 0.005 && (
          <Alert tone="warning" className="mt-3" icon={<TriangleAlert className="h-4 w-4" />}>
            {formatCurrency(Math.abs(stats.unallocated))}{' '}
            {stats.unallocated > 0 ? 'of the total is not allocated to anyone' : 'has been over-allocated'}
            {stats.splitCount === 0
              ? ' because nobody has confirmed attendance yet.'
              : isAdmin
                ? '. Recalculate to fix the split.'
                : '. The admin needs to recalculate the split.'}
          </Alert>
        )}

        {match.contributions_finalized && (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-coal-500">
            <BadgeCheck className="h-3.5 w-3.5 text-pitch-500" />
            Contributions were finalized — changes are recorded in the audit history.
          </p>
        )}
      </div>

      {/* ---------------------------- Line items ------------------------- */}
      {expenseItems.length > 0 && (
        <div>
          <h3 className="section-title mb-2">What the money went on</h3>
          <ul className="divide-y divide-coal-800 overflow-hidden rounded-xl border border-coal-800">
            {expenseItems.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 bg-coal-925/60 px-4 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-coal-100">{item.label}</p>
                  <p className="text-xs text-coal-500">
                    {EXPENSE_CATEGORIES.find((c) => c.value === item.category)?.label ?? item.category}
                  </p>
                </div>
                <p className="shrink-0 font-semibold tabular-nums text-coal-200">
                  {formatCurrency(item.amount)}
                </p>
              </li>
            ))}
            <li className="flex items-center justify-between gap-3 bg-coal-900 px-4 py-2.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-coal-400">
                Line items total
              </p>
              <p
                className={cn(
                  'shrink-0 font-bold tabular-nums',
                  Math.abs(itemsTotal - stats.total) < 0.005 ? 'text-pitch-300' : 'text-amber-300'
                )}
              >
                {formatCurrency(itemsTotal)}
              </p>
            </li>
          </ul>
          {Math.abs(itemsTotal - stats.total) >= 0.005 && (
            <p className="mt-1.5 text-xs text-amber-400/90">
              Line items do not add up to the match total of {formatCurrency(stats.total)}. The split
              always uses the match total.
            </p>
          )}
        </div>
      )}

      {/* -------------------------- Per-player table --------------------- */}
      <div>
        <h3 className="section-title mb-2">Per-player contribution</h3>

        {sorted.length === 0 ? (
          <EmptyState
            icon={<Users className="h-5 w-5" />}
            title="No contributions yet"
            description="Contributions appear once players vote “Yes” and the split is calculated."
          />
        ) : (
          <ul className="divide-y divide-coal-800 overflow-hidden rounded-xl border border-coal-800">
            {sorted.map((c) => {
              const paid = paidByPlayer.get(c.player_id) ?? 0
              const due = toNumber(c.amount_due)
              const isMe = c.player_id === currentPlayerId

              return (
                <li
                  key={c.id}
                  className={cn(
                    'flex items-center gap-3 bg-coal-925/60 px-3 py-3 sm:px-4',
                    isMe && 'bg-pitch-950/30'
                  )}
                >
                  <Avatar
                    id={c.player_id}
                    name={c.player?.full_name}
                    url={c.player?.avatar_url}
                    size="sm"
                  />

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-coal-100">
                      {c.player?.full_name ?? 'Unknown player'}
                      {isMe && <span className="ml-1.5 text-xs font-normal text-pitch-500">(you)</span>}
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                      {c.is_exempt && (
                        <Badge className="bg-sky-600/20 text-sky-300 ring-sky-800/50">
                          <Gift className="h-3 w-3" /> Exempt
                        </Badge>
                      )}
                      {c.is_manual_override && !c.is_exempt && (
                        <Badge className="bg-amber-500/15 text-amber-300 ring-amber-800/50">
                          <Pencil className="h-3 w-3" /> Adjusted
                        </Badge>
                      )}
                      {paid > 0 && (
                        <span className="text-xs text-coal-500">
                          {formatCurrency(paid)} paid
                        </span>
                      )}
                      {c.override_reason && (
                        <span className="truncate text-xs text-coal-600" title={c.override_reason}>
                          {c.override_reason}
                        </span>
                      )}
                    </div>
                  </div>

                  <p
                    className={cn(
                      'shrink-0 text-right font-display text-base font-bold tabular-nums',
                      c.is_exempt ? 'text-coal-500 line-through' : 'text-white'
                    )}
                  >
                    {formatCurrency(due)}
                  </p>

                  {isAdmin && (
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditor(c)}
                        aria-label={`Adjust ${c.player?.full_name ?? 'player'}'s contribution`}
                        className="rounded-lg p-2 text-coal-500 transition-colors hover:bg-coal-800 hover:text-amber-300"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void onToggleExempt(c.player_id, !c.is_exempt)}
                        aria-label={
                          c.is_exempt
                            ? `Remove exemption for ${c.player?.full_name ?? 'player'}`
                            : `Exempt ${c.player?.full_name ?? 'player'} from payment`
                        }
                        className={cn(
                          'rounded-lg p-2 transition-colors hover:bg-coal-800',
                          c.is_exempt ? 'text-sky-400' : 'text-coal-500 hover:text-sky-300'
                        )}
                      >
                        <Gift className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </li>
              )
            })}

            <li className="flex items-center justify-between gap-3 bg-coal-900 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-coal-400">
                Total allocated · {stats.contributorCount} players
              </p>
              <p
                className={cn(
                  'font-display text-lg font-bold tabular-nums',
                  Math.abs(stats.unallocated) < 0.005 ? 'text-pitch-300' : 'text-amber-300'
                )}
              >
                {formatCurrency(stats.assigned)}
              </p>
            </li>
          </ul>
        )}

        {(stats.exemptCount > 0 || stats.manualCount > 0) && (
          <p className="mt-2 text-xs text-coal-500">
            {stats.exemptCount > 0 && `${stats.exemptCount} exempt. `}
            {stats.manualCount > 0 && `${stats.manualCount} manually adjusted. `}
            The remaining players cover the balance so the total always matches{' '}
            {formatCurrency(stats.total)}.
          </p>
        )}
      </div>

      {/* --------------------------- Adjust modal ------------------------ */}
      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={`Adjust ${editing?.player?.full_name ?? 'contribution'}`}
        description="The rest of the squad will be re-split to cover the remaining balance."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)} disabled={saving}>
              Cancel
            </Button>
            {editing?.is_manual_override && (
              <Button
                variant="secondary"
                disabled={saving}
                onClick={async () => {
                  if (!editing) return
                  setSaving(true)
                  try {
                    await onClearManual(editing.player_id)
                    setEditing(null)
                  } finally {
                    setSaving(false)
                  }
                }}
              >
                Reset to equal share
              </Button>
            )}
            <Button onClick={() => void saveManual()} loading={saving}>
              Save amount
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Amount due"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value)
              setAmountError(undefined)
            }}
            error={amountError}
            prefix={<IndianRupee className="h-4 w-4" />}
            hint={`Equal share right now is ${formatCurrency(stats.perPlayer)}.`}
            required
          />
          <Textarea
            label="Reason (recommended)"
            placeholder="e.g. Brought the match ball, so paying ₹100 less."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            hint="Stored in the audit history so the team can see why."
          />
        </div>
      </Modal>
    </div>
  )
}

function MiniStat({
  icon,
  label,
  value,
  tone = 'default',
}: {
  icon: React.ReactNode
  label: string
  value: string
  tone?: 'default' | 'green' | 'amber'
}) {
  const tones = {
    default: 'text-coal-100',
    green: 'text-pitch-300',
    amber: 'text-amber-300',
  }
  return (
    <div className="rounded-lg bg-coal-900/80 p-3">
      <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-coal-500">
        {icon}
        {label}
      </p>
      <p className={cn('mt-1 font-display text-xl font-bold tabular-nums', tones[tone])}>{value}</p>
    </div>
  )
}
