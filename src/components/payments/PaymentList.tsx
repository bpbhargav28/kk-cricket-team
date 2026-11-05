import { useMemo, useState } from 'react'
import { CheckCircle2, IndianRupee, Search, Wallet } from 'lucide-react'
import type { PaymentMethod, PaymentStatus, PaymentWithPlayer } from '../../lib/database.types'
import { PAYMENT_METHODS, PAYMENT_STATUS_STYLES } from '../../lib/constants'
import { cn } from '../../lib/cn'
import { formatCurrency, formatDateTime, round2, toNumber } from '../../lib/format'
import { Avatar, Badge, EmptyState } from '../ui/Misc'
import { Button } from '../ui/Button'
import { Input, Select } from '../ui/Field'
import { Modal } from '../ui/Modal'

interface PaymentListProps {
  payments: PaymentWithPlayer[]
  isAdmin: boolean
  currentPlayerId: string
  onRecord: (
    playerId: string,
    amount: number,
    method: PaymentMethod | null,
    notes: string | null
  ) => Promise<void>
  onMarkPaid: (playerId: string) => Promise<void>
}

type Filter = 'all' | PaymentStatus

export function PaymentList({
  payments,
  isAdmin,
  currentPlayerId,
  onRecord,
  onMarkPaid,
}: PaymentListProps) {
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<PaymentWithPlayer | null>(null)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('upi')
  const [notes, setNotes] = useState('')
  const [amountError, setAmountError] = useState<string | undefined>()
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return payments
      .filter((p) => (filter === 'all' ? true : p.status === filter))
      .filter((p) => (q ? (p.player?.full_name ?? '').toLowerCase().includes(q) : true))
      .sort((a, b) => {
        // Pending first — that is what an admin chasing money wants to see.
        const order: Record<PaymentStatus, number> = { pending: 0, partially_paid: 1, paid: 2 }
        const diff = order[a.status] - order[b.status]
        if (diff !== 0) return diff
        return (a.player?.full_name ?? '').localeCompare(b.player?.full_name ?? '')
      })
  }, [payments, filter, query])

  function openEditor(payment: PaymentWithPlayer) {
    setEditing(payment)
    setAmount(toNumber(payment.amount_paid).toFixed(2))
    setMethod(payment.method ?? 'upi')
    setNotes(payment.notes ?? '')
    setAmountError(undefined)
  }

  async function save() {
    if (!editing) return
    const parsed = Number.parseFloat(amount)
    if (!Number.isFinite(parsed) || parsed < 0) {
      setAmountError('Enter an amount of ₹0 or more.')
      return
    }
    const due = toNumber(editing.amount_due)
    if (parsed > due + 0.005) {
      setAmountError(`That is more than the ${formatCurrency(due)} due. Adjust the contribution instead.`)
      return
    }

    setSaving(true)
    try {
      await onRecord(editing.player_id, round2(parsed), method, notes.trim() || null)
      setEditing(null)
    } finally {
      setSaving(false)
    }
  }

  const counts = useMemo(
    () => ({
      all: payments.length,
      pending: payments.filter((p) => p.status === 'pending').length,
      partially_paid: payments.filter((p) => p.status === 'partially_paid').length,
      paid: payments.filter((p) => p.status === 'paid').length,
    }),
    [payments]
  )

  if (payments.length === 0) {
    return (
      <EmptyState
        icon={<Wallet className="h-5 w-5" />}
        title="No payment records yet"
        description={
          isAdmin
            ? 'Payment rows are created automatically once the expense split has been calculated.'
            : 'Your payment record will appear once the admin calculates the match split.'
        }
      />
    )
  }

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 sm:pb-0">
          {(['all', 'pending', 'partially_paid', 'paid'] as Filter[]).map((f) => {
            const active = filter === f
            const label =
              f === 'all' ? 'All' : PAYMENT_STATUS_STYLES[f as PaymentStatus].label
            return (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={cn(
                  'shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
                  active
                    ? 'bg-pitch-600 text-white'
                    : 'bg-coal-800/70 text-coal-400 hover:bg-coal-800 hover:text-coal-200'
                )}
              >
                {label}
                <span className="ml-1.5 tabular-nums opacity-70">{counts[f]}</span>
              </button>
            )
          })}
        </div>

        {isAdmin && payments.length > 6 && (
          <Input
            placeholder="Search players…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            prefix={<Search className="h-4 w-4" />}
            wrapperClassName="sm:ml-auto sm:max-w-56"
            aria-label="Search players"
          />
        )}
      </div>

      {visible.length === 0 ? (
        <EmptyState title="Nothing matches that filter" />
      ) : (
        <ul className="divide-y divide-coal-800 overflow-hidden rounded-xl border border-coal-800">
          {visible.map((p) => {
            const status = PAYMENT_STATUS_STYLES[p.status]
            const due = toNumber(p.amount_due)
            const paid = toNumber(p.amount_paid)
            const remaining = round2(Math.max(due - paid, 0))
            const isMe = p.player_id === currentPlayerId

            return (
              <li
                key={p.id}
                className={cn(
                  'flex flex-wrap items-center gap-x-3 gap-y-2 bg-coal-925/60 px-3 py-3 sm:px-4',
                  isMe && 'bg-pitch-950/30'
                )}
              >
                <Avatar
                  id={p.player_id}
                  name={p.player?.full_name}
                  url={p.player?.avatar_url}
                  size="sm"
                />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-coal-100">
                    {p.player?.full_name ?? 'You'}
                    {isMe && <span className="ml-1.5 text-xs font-normal text-pitch-500">(you)</span>}
                  </p>
                  <p className="mt-0.5 text-xs text-coal-500">
                    {formatCurrency(paid)} of {formatCurrency(due)} paid
                    {p.payment_date && <> · {formatDateTime(p.payment_date)}</>}
                    {p.method && <> · {PAYMENT_METHODS.find((m) => m.value === p.method)?.label}</>}
                  </p>
                  {p.notes && <p className="mt-0.5 truncate text-xs text-coal-600">{p.notes}</p>}
                </div>

                <div className="ml-auto flex items-center gap-2 sm:ml-0">
                  <div className="text-right">
                    <p
                      className={cn(
                        'font-display text-base font-bold tabular-nums',
                        p.status === 'paid' ? 'text-pitch-300' : 'text-white'
                      )}
                    >
                      {p.status === 'paid' ? formatCurrency(due) : formatCurrency(remaining)}
                    </p>
                    <p className="text-[10px] uppercase tracking-wider text-coal-500">
                      {p.status === 'paid' ? 'Settled' : 'Remaining'}
                    </p>
                  </div>
                  <Badge className={status.className}>{status.label}</Badge>
                </div>

                {isAdmin && (
                  <div className="flex w-full items-center gap-2 sm:w-auto">
                    {p.status !== 'paid' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 sm:flex-none"
                        loading={busyId === p.id}
                        icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                        onClick={async () => {
                          setBusyId(p.id)
                          try {
                            await onMarkPaid(p.player_id)
                          } finally {
                            setBusyId(null)
                          }
                        }}
                      >
                        Mark paid
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="secondary"
                      className="flex-1 sm:flex-none"
                      onClick={() => openEditor(p)}
                    >
                      {p.status === 'paid' ? 'Edit' : 'Part payment'}
                    </Button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {/* Record payment modal */}
      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={`Record payment — ${editing?.player?.full_name ?? ''}`}
        description={
          editing ? `Amount due is ${formatCurrency(editing.amount_due)}.` : undefined
        }
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void save()} loading={saving}>
              Save payment
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Amount received"
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
            hint="Enter the full amount to settle, or a smaller amount for a part payment. Set 0 to reset."
            required
          />
          <Select
            label="Method"
            value={method}
            onChange={(e) => setMethod(e.target.value as PaymentMethod)}
            options={PAYMENT_METHODS.map((m) => ({ value: m.value, label: m.label }))}
          />
          <Input
            label="Note (optional)"
            placeholder="e.g. Paid via UPI on match day"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={500}
          />
        </div>
      </Modal>
    </div>
  )
}
