import { useCallback, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CheckCircle2, IndianRupee, ListPlus, Plus, Trash2, TriangleAlert } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useAsyncData } from '../hooks/useAsyncData'
import * as api from '../lib/api'
import type { MatchInput } from '../lib/api'
import type { ExpenseCategory } from '../lib/database.types'
import { EXPENSE_CATEGORIES } from '../lib/constants'
import { friendlyError } from '../lib/errors'
import { formatCurrency, round2, toNumber } from '../lib/format'
import { PageHeader } from '../components/layout/PageHeader'
import { MatchForm } from '../components/match/MatchForm'
import { Card, CardHeader } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input, Select } from '../components/ui/Field'
import { Alert, PageLoader } from '../components/ui/Misc'
import { ConfirmDialog, Modal } from '../components/ui/Modal'
import { Textarea } from '../components/ui/Field'

export default function EditMatch() {
  const { matchId = '' } = useParams()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()

  const match = useAsyncData(() => api.fetchMatch(matchId), [matchId])
  const votes = useAsyncData(() => api.fetchVotes(matchId), [matchId])
  const items = useAsyncData(() => api.fetchExpenseItems(matchId), [matchId])

  const [submitting, setSubmitting] = useState(false)
  const [resplit, setResplit] = useState<{ input: MatchInput } | null>(null)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const confirmedCount = useMemo(
    () => (votes.data ?? []).filter((v) => v.vote === 'yes').length,
    [votes.data]
  )

  const save = useCallback(
    async (input: MatchInput, resplitAfter: boolean) => {
      setSubmitting(true)
      try {
        await api.updateMatch(matchId, input)

        if (resplitAfter) {
          const result = await api.recalculateContributions(
            matchId,
            true,
            'Match expense updated by admin'
          )
          toast.success(
            `Split updated — ${formatCurrency(result.per_player)} each across ${result.split_between} players.`,
            'Contributions recalculated'
          )
        } else {
          toast.success('Match details saved.')
        }

        await match.refresh()
        navigate(`/matches/${matchId}`)
      } catch (err) {
        toast.error(friendlyError(err, 'Could not save the match.'))
      } finally {
        setSubmitting(false)
        setResplit(null)
      }
    },
    [matchId, match, navigate, toast]
  )

  async function handleSubmit(input: MatchInput) {
    const current = match.data
    if (!current) return

    const expenseChanged =
      round2(input.total_expense) !== round2(toNumber(current.total_expense))

    // Never silently rewrite amounts somebody may already have paid against.
    if (expenseChanged && current.contributions_finalized) {
      setResplit({ input })
      return
    }

    await save(input, expenseChanged)
  }

  async function handleCancel() {
    setBusy(true)
    try {
      await api.cancelMatch(matchId, cancelReason.trim() || 'Cancelled by admin')
      toast.success('Match cancelled. Voting is now closed.')
      navigate(`/matches/${matchId}`)
    } catch (err) {
      toast.error(friendlyError(err, 'Could not cancel the match.'))
    } finally {
      setBusy(false)
      setCancelOpen(false)
    }
  }

  async function handleComplete() {
    setBusy(true)
    try {
      await api.completeMatch(matchId)
      toast.success('Match marked as completed.')
      await match.refresh()
    } catch (err) {
      toast.error(friendlyError(err, 'Could not update the match.'))
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    setBusy(true)
    try {
      await api.deleteMatch(matchId)
      toast.success('Match deleted.')
      navigate('/matches', { replace: true })
    } catch (err) {
      toast.error(friendlyError(err, 'Could not delete the match.'))
    } finally {
      setBusy(false)
      setDeleteOpen(false)
    }
  }

  if (match.loading && !match.data) return <PageLoader label="Loading match…" />
  if (match.error || !match.data) {
    return (
      <div className="py-8">
        <Alert tone="danger">{match.error ?? 'That match could not be found.'}</Alert>
      </div>
    )
  }

  const current = match.data
  const itemsTotal = (items.data ?? []).reduce((s, i) => s + toNumber(i.amount), 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit match"
        subtitle={current.title}
        backTo={`/matches/${matchId}`}
        backLabel="Back to match"
      />

      {current.contributions_finalized && (
        <Alert tone="info" title="Contributions are finalized">
          Editing the total expense will ask you to confirm a re-split. Every change is written to
          the match audit history, so nothing changes silently.
        </Alert>
      )}

      <MatchForm
        initial={current}
        confirmedCount={confirmedCount}
        submitLabel="Save changes"
        submitting={submitting}
        onSubmit={handleSubmit}
        onCancel={() => navigate(`/matches/${matchId}`)}
      />

      <ExpenseItems
        matchId={matchId}
        createdBy={profile?.id ?? ''}
        items={items.data ?? []}
        total={toNumber(current.total_expense)}
        itemsTotal={itemsTotal}
        onChanged={() => void items.refresh()}
      />

      {/* ----------------------------- Danger zone --------------------- */}
      <Card className="border-rose-900/50">
        <CardHeader
          title="Match status"
          subtitle="Cancelling closes voting but keeps the record. Deleting removes everything."
          icon={<TriangleAlert className="h-4 w-4" />}
        />
        <div className="flex flex-wrap gap-2">
          {current.status === 'upcoming' && (
            <Button
              variant="secondary"
              icon={<CheckCircle2 className="h-4 w-4" />}
              loading={busy}
              onClick={() => void handleComplete()}
            >
              Mark as completed
            </Button>
          )}
          {current.status !== 'cancelled' && (
            <Button variant="secondary" onClick={() => setCancelOpen(true)}>
              Cancel match
            </Button>
          )}
          <Button
            variant="danger"
            icon={<Trash2 className="h-4 w-4" />}
            onClick={() => setDeleteOpen(true)}
          >
            Delete match
          </Button>
        </div>
      </Card>

      {/* ------------------------- Re-split confirmation --------------- */}
      <ConfirmDialog
        open={resplit !== null}
        title="Re-split the finalized contributions?"
        message={
          <div className="space-y-2">
            <p>
              This match was finalized at{' '}
              <strong>{formatCurrency(current.total_expense)}</strong>. Saving{' '}
              <strong>{formatCurrency(resplit?.input.total_expense ?? 0)}</strong> will recalculate
              what every confirmed player owes.
            </p>
            <p className="text-coal-400">
              Manual adjustments, exemptions and recorded payments are preserved, and the previous
              amounts are kept in the audit history.
            </p>
          </div>
        }
        confirmLabel="Save and re-split"
        loading={submitting}
        onConfirm={() => resplit && void save(resplit.input, true)}
        onCancel={() => setResplit(null)}
      />

      <Modal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Cancel this match?"
        description="Voting closes immediately and the match is marked cancelled for everyone."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCancelOpen(false)} disabled={busy}>
              Keep match
            </Button>
            <Button variant="danger" loading={busy} onClick={() => void handleCancel()}>
              Cancel match
            </Button>
          </>
        }
      >
        <Input
          label="Reason"
          placeholder="e.g. Ground waterlogged after overnight rain"
          value={cancelReason}
          onChange={(e) => setCancelReason(e.target.value)}
          hint="Shown to the squad on the match page."
        />
      </Modal>

      <ConfirmDialog
        open={deleteOpen}
        title="Delete this match permanently?"
        message="Every vote, contribution and payment record for this match will be removed. This cannot be undone — cancel the match instead if you want to keep the history."
        confirmLabel="Delete permanently"
        destructive
        loading={busy}
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteOpen(false)}
      />
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Expense line items                                                        */
/* -------------------------------------------------------------------------- */

function ExpenseItems({
  matchId,
  createdBy,
  items,
  total,
  itemsTotal,
  onChanged,
}: {
  matchId: string
  createdBy: string
  items: Awaited<ReturnType<typeof api.fetchExpenseItems>>
  total: number
  itemsTotal: number
  onChanged: () => void
}) {
  const toast = useToast()
  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState<ExpenseCategory>('ground')
  const [notes, setNotes] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | undefined>()

  async function add(e: React.FormEvent) {
    e.preventDefault()
    const parsed = Number.parseFloat(amount)
    if (label.trim().length < 2) {
      setError('Give the item a short label.')
      return
    }
    if (!Number.isFinite(parsed) || parsed < 0) {
      setError('Enter a valid amount.')
      return
    }

    setAdding(true)
    setError(undefined)
    try {
      await api.addExpenseItem(
        matchId,
        { label: label.trim(), amount: round2(parsed), category, notes: notes.trim() || null },
        createdBy
      )
      setLabel('')
      setAmount('')
      setNotes('')
      onChanged()
      toast.success('Expense item added.')
    } catch (err) {
      toast.error(friendlyError(err, 'Could not add the expense item.'))
    } finally {
      setAdding(false)
    }
  }

  async function remove(id: string) {
    try {
      await api.deleteExpenseItem(id)
      onChanged()
      toast.success('Expense item removed.')
    } catch (err) {
      toast.error(friendlyError(err, 'Could not remove the item.'))
    }
  }

  return (
    <Card>
      <CardHeader
        title="Expense breakdown"
        subtitle="Optional line items so the squad can see where the money goes."
        icon={<ListPlus className="h-4 w-4" />}
      />

      {items.length > 0 && (
        <ul className="mb-4 divide-y divide-coal-800 overflow-hidden rounded-xl border border-coal-800">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 bg-coal-925/60 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-coal-100">{item.label}</p>
                <p className="text-xs text-coal-500">
                  {EXPENSE_CATEGORIES.find((c) => c.value === item.category)?.label}
                  {item.notes && ` · ${item.notes}`}
                </p>
              </div>
              <p className="shrink-0 font-semibold tabular-nums text-coal-200">
                {formatCurrency(item.amount)}
              </p>
              <button
                type="button"
                onClick={() => void remove(item.id)}
                aria-label={`Remove ${item.label}`}
                className="shrink-0 rounded-lg p-2 text-coal-500 transition-colors hover:bg-coal-800 hover:text-rose-300"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {items.length > 0 && Math.abs(itemsTotal - total) >= 0.005 && (
        <Alert tone="warning" className="mb-4">
          Line items add up to {formatCurrency(itemsTotal)} but the match total is{' '}
          {formatCurrency(total)}. The split always uses the match total — update it above if the
          line items are correct.
        </Alert>
      )}

      <form onSubmit={add} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          <Input
            label="Item"
            placeholder="Ground booking"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            error={error}
          />
          <Input
            label="Amount"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            placeholder="1500"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            prefix={<IndianRupee className="h-4 w-4" />}
            wrapperClassName="sm:w-40"
          />
          <Select
            label="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
            options={EXPENSE_CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
          />
        </div>
        <Textarea
          label="Note (optional)"
          rows={2}
          placeholder="Paid in advance to the ground manager"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <Button type="submit" variant="secondary" loading={adding} icon={<Plus className="h-4 w-4" />}>
          Add item
        </Button>
      </form>
    </Card>
  )
}
