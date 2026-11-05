import { useCallback, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  CalendarDays,
  Clock,
  History as HistoryIcon,
  IndianRupee,
  Lock,
  LockOpen,
  MapPin,
  Pencil,
  Users,
  Wallet,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useAsyncData } from '../hooks/useAsyncData'
import { useRealtime } from '../hooks/useRealtime'
import * as api from '../lib/api'
import type { PaymentMethod, VoteValue } from '../lib/database.types'
import { MATCH_STATUS_STYLES } from '../lib/constants'
import { cn } from '../lib/cn'
import { friendlyError } from '../lib/errors'
import {
  formatCurrency,
  formatCurrencyShort,
  formatDateTime,
  formatMatchDate,
  formatMatchTime,
  formatRelative,
  toNumber,
} from '../lib/format'
import { PageHeader } from '../components/layout/PageHeader'
import { Card, CardHeader } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Alert, Badge, PageLoader } from '../components/ui/Misc'
import { ConfirmDialog } from '../components/ui/Modal'
import { VotePanel } from '../components/match/VotePanel'
import { VoteResults } from '../components/match/VoteResults'
import { VotePills } from '../components/match/VotePills'
import { ExpenseBreakdown } from '../components/match/ExpenseBreakdown'
import { PaymentList } from '../components/payments/PaymentList'
import { PaymentSummaryTiles } from '../components/payments/PaymentSummaryTiles'
import { AuditTrail } from '../components/match/AuditTrail'

type Tab = 'attendance' | 'expenses' | 'payments' | 'activity'

export default function MatchDetail() {
  const { matchId = '' } = useParams()
  const { profile, isAdmin } = useAuth()
  const toast = useToast()
  const [tab, setTab] = useState<Tab>('attendance')
  const [closeOpen, setCloseOpen] = useState(false)
  const [reopenOpen, setReopenOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const match = useAsyncData(() => api.fetchMatch(matchId), [matchId])
  const votes = useAsyncData(() => api.fetchVotes(matchId), [matchId])
  const players = useAsyncData(() => api.fetchPlayers(), [])
  const contributions = useAsyncData(() => api.fetchContributions(matchId), [matchId])
  const expenseItems = useAsyncData(() => api.fetchExpenseItems(matchId), [matchId])
  const payments = useAsyncData(() => api.fetchMatchPayments(matchId), [matchId])
  const paymentSummary = useAsyncData(() => api.fetchPaymentSummary(matchId), [matchId])
  const audit = useAsyncData(() => api.fetchAuditTrail(matchId), [matchId], {
    enabled: tab === 'activity',
  })

  /** One refresh for everything that a vote / split / payment can touch. */
  const refreshAll = useCallback(() => {
    void match.refresh()
    void votes.refresh()
    void contributions.refresh()
    void payments.refresh()
    void paymentSummary.refresh()
    if (tab === 'activity') void audit.refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match, votes, contributions, payments, paymentSummary, audit, tab])

  useRealtime(
    `match-${matchId}`,
    [
      { table: 'matches', filter: `id=eq.${matchId}` },
      { table: 'match_votes', filter: `match_id=eq.${matchId}` },
      { table: 'player_contributions', filter: `match_id=eq.${matchId}` },
      { table: 'payments', filter: `match_id=eq.${matchId}` },
    ],
    refreshAll,
    Boolean(matchId)
  )

  const data = match.data
  const myVote = useMemo(
    () => (votes.data ?? []).find((v) => v.player_id === profile?.id)?.vote ?? null,
    [votes.data, profile?.id]
  )
  const counts = useMemo(() => {
    const list = votes.data ?? []
    return {
      yes: list.filter((v) => v.vote === 'yes').length,
      no: list.filter((v) => v.vote === 'no').length,
      maybe: list.filter((v) => v.vote === 'maybe').length,
    }
  }, [votes.data])

  const myContribution = useMemo(
    () => (contributions.data ?? []).find((c) => c.player_id === profile?.id) ?? null,
    [contributions.data, profile?.id]
  )

  const deadlinePassed = Boolean(
    data?.voting_deadline && new Date(data.voting_deadline) < new Date()
  )
  const votingOpen = Boolean(
    data?.voting_open && data.status === 'upcoming' && !deadlinePassed
  )

  /* --------------------------------- actions ----------------------------- */

  async function handleVote(vote: VoteValue) {
    if (!data || !profile) return
    try {
      await api.castVote(data.id, profile.id, vote)
      await Promise.all([votes.refresh(), contributions.refresh()])
      toast.success(
        vote === 'yes'
          ? "You're in for this match."
          : vote === 'no'
            ? 'Marked as unavailable.'
            : "Marked as 'not sure'."
      )
    } catch (err) {
      toast.error(friendlyError(err, 'Could not save your vote.'))
    }
  }

  async function handleCloseVoting() {
    setBusy(true)
    try {
      const result = await api.closeVoting(matchId, true)
      toast.success(
        result.split_between > 0
          ? `${formatCurrency(result.per_player)} each across ${result.split_between} confirmed players.`
          : 'Voting closed. Nobody confirmed, so there is nothing to split.',
        'Voting closed and contributions finalized'
      )
      refreshAll()
    } catch (err) {
      toast.error(friendlyError(err, 'Could not close voting.'))
    } finally {
      setBusy(false)
      setCloseOpen(false)
    }
  }

  async function handleReopenVoting() {
    setBusy(true)
    try {
      await api.reopenVoting(matchId)
      toast.success('Voting reopened. Players can change their vote again.')
      refreshAll()
    } catch (err) {
      toast.error(friendlyError(err, 'Could not reopen voting.'))
    } finally {
      setBusy(false)
      setReopenOpen(false)
    }
  }

  const recalculate = useCallback(
    async (reason?: string) => {
      try {
        const result = await api.recalculateContributions(matchId, true, reason)
        toast.success(
          result.split_between > 0
            ? `${formatCurrency(result.per_player)} each across ${result.split_between} players.`
            : 'Nothing to split — no confirmed players.',
          'Split recalculated'
        )
        refreshAll()
      } catch (err) {
        toast.error(friendlyError(err, 'Could not recalculate the split.'))
      }
    },
    [matchId, toast, refreshAll]
  )

  /* --------------------------------- render ------------------------------ */

  if (match.loading && !data) return <PageLoader label="Loading match…" />

  if (match.error || !data) {
    return (
      <div className="py-8">
        <Alert tone="danger" title="Match not available">
          {match.error ?? 'That match does not exist, or you do not have access to it.'}
        </Alert>
        <Link to="/matches" className="mt-4 inline-block text-sm font-semibold text-pitch-400">
          ← Back to matches
        </Link>
      </div>
    )
  }

  const status = MATCH_STATUS_STYLES[data.status]
  const perPlayerNow = counts.yes > 0 ? toNumber(data.total_expense) / counts.yes : 0

  const tabs: Array<{ id: Tab; label: string; icon: typeof Users }> = [
    { id: 'attendance', label: 'Attendance', icon: Users },
    { id: 'expenses', label: 'Expenses', icon: IndianRupee },
    { id: 'payments', label: 'Payments', icon: Wallet },
    { id: 'activity', label: 'Activity', icon: HistoryIcon },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        title={data.title}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" />
              {formatMatchDate(data.match_date)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              {formatMatchTime(data.match_time)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              {data.location}
            </span>
          </span>
        }
        backTo="/matches"
        backLabel="Back to matches"
        action={
          isAdmin ? (
            <div className="flex flex-wrap gap-2">
              <Link to={`/matches/${matchId}/edit`}>
                <Button size="sm" variant="secondary" icon={<Pencil className="h-3.5 w-3.5" />}>
                  Edit
                </Button>
              </Link>
              {data.status === 'upcoming' &&
                (data.voting_open ? (
                  <Button
                    size="sm"
                    icon={<Lock className="h-3.5 w-3.5" />}
                    onClick={() => setCloseOpen(true)}
                  >
                    Close voting
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    icon={<LockOpen className="h-3.5 w-3.5" />}
                    onClick={() => setReopenOpen(true)}
                  >
                    Reopen voting
                  </Button>
                ))}
            </div>
          ) : undefined
        }
      />

      {/* --------------------------- Summary strip ---------------------- */}
      <Card className="overflow-hidden p-0">
        <div
          className={cn(
            'h-1',
            data.status === 'cancelled'
              ? 'bg-gradient-to-r from-rose-700 to-rose-500'
              : data.status === 'completed'
                ? 'bg-coal-700'
                : 'bg-pitch-gradient'
          )}
        />
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3 p-4 sm:px-5">
          <Badge className={status.className}>{status.label}</Badge>
          <VotePills yes={counts.yes} no={counts.no} maybe={counts.maybe} />
          <div className="flex items-baseline gap-1.5">
            <span className="text-xs uppercase tracking-wider text-coal-500">Total</span>
            <span className="font-display text-lg font-bold text-white">
              {formatCurrencyShort(data.total_expense)}
            </span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xs uppercase tracking-wider text-coal-500">
              {myContribution ? 'Your share' : 'Per player'}
            </span>
            <span className="font-display text-lg font-bold text-pitch-300">
              {myContribution
                ? formatCurrency(myContribution.amount_due)
                : counts.yes > 0
                  ? formatCurrency(perPlayerNow)
                  : '—'}
            </span>
          </div>
          {data.status === 'upcoming' && (
            <span className="ml-auto text-xs font-medium text-coal-500">
              {votingOpen
                ? data.voting_deadline
                  ? `Voting closes ${formatRelative(data.voting_deadline)}`
                  : 'Voting is open'
                : 'Voting closed'}
            </span>
          )}
        </div>
      </Card>

      {data.status === 'cancelled' && (
        <Alert tone="danger" title="This match was cancelled">
          {data.cancellation_reason ?? 'No reason was given.'}
        </Alert>
      )}

      {data.description && (
        <Card>
          <p className="whitespace-pre-line text-sm leading-relaxed text-coal-300">
            {data.description}
          </p>
        </Card>
      )}

      {/* ------------------------------ Tabs ---------------------------- */}
      <div className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id)
              if (t.id === 'activity') void audit.refresh()
            }}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors',
              tab === t.id
                ? 'bg-pitch-600/15 text-pitch-300 ring-1 ring-inset ring-pitch-700/50'
                : 'text-coal-400 hover:bg-coal-900 hover:text-coal-200'
            )}
            aria-current={tab === t.id ? 'page' : undefined}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* --------------------------- Tab panels ------------------------- */}
      {tab === 'attendance' && (
        <div className="space-y-5 animate-fade-in">
          {data.status !== 'cancelled' && (
            <Card>
              <VotePanel
                myVote={myVote}
                votingOpen={votingOpen}
                deadline={data.voting_deadline}
                closedReason={
                  data.status !== 'upcoming'
                    ? 'This match has already been played.'
                    : deadlinePassed
                      ? `The voting deadline passed on ${formatDateTime(data.voting_deadline)}.`
                      : 'The admin has closed voting for this match.'
                }
                onVote={handleVote}
              />
            </Card>
          )}

          <Card>
            <CardHeader
              title="Live voting results"
              subtitle="Updates in real time as teammates vote."
              icon={<Users className="h-4 w-4" />}
            />
            <VoteResults
              votes={votes.data ?? []}
              players={players.data ?? []}
              currentPlayerId={profile?.id}
            />
          </Card>
        </div>
      )}

      {tab === 'expenses' && (
        <div className="animate-fade-in">
          <Card>
            <ExpenseBreakdown
              match={data}
              contributions={contributions.data ?? []}
              expenseItems={expenseItems.data ?? []}
              payments={payments.data ?? []}
              isAdmin={isAdmin}
              currentPlayerId={profile?.id ?? ''}
              onRecalculate={() => recalculate('Manual recalculation by admin')}
              onSetManual={async (playerId, amount, reason) => {
                try {
                  await api.setManualContribution(matchId, playerId, amount, reason || undefined)
                  toast.success('Contribution adjusted and the rest of the squad re-split.')
                  refreshAll()
                } catch (err) {
                  toast.error(friendlyError(err, 'Could not adjust the contribution.'))
                }
              }}
              onClearManual={async (playerId) => {
                try {
                  await api.clearManualContribution(matchId, playerId)
                  toast.success('Reset to an equal share.')
                  refreshAll()
                } catch (err) {
                  toast.error(friendlyError(err, 'Could not reset the contribution.'))
                }
              }}
              onToggleExempt={async (playerId, exempt, reason) => {
                try {
                  await api.setPlayerExemption(matchId, playerId, exempt, reason)
                  toast.success(
                    exempt
                      ? 'Player exempted. The rest of the squad covers the balance.'
                      : 'Exemption removed.'
                  )
                  refreshAll()
                } catch (err) {
                  toast.error(friendlyError(err, 'Could not update the exemption.'))
                }
              }}
            />
          </Card>
        </div>
      )}

      {tab === 'payments' && (
        <div className="space-y-5 animate-fade-in">
          <PaymentSummaryTiles summary={paymentSummary.data} />

          <Card>
            <CardHeader
              title={isAdmin ? 'Player payments' : 'Your payment'}
              subtitle={
                isAdmin
                  ? 'Mark payments as fully or partially received.'
                  : 'Only your own record is visible. The totals above cover the whole match.'
              }
              icon={<Wallet className="h-4 w-4" />}
            />
            <PaymentList
              payments={payments.data ?? []}
              isAdmin={isAdmin}
              currentPlayerId={profile?.id ?? ''}
              onRecord={async (
                playerId: string,
                amount: number,
                method: PaymentMethod | null,
                notes: string | null
              ) => {
                try {
                  await api.recordPayment(matchId, playerId, amount, method, notes)
                  toast.success('Payment recorded.')
                  refreshAll()
                } catch (err) {
                  toast.error(friendlyError(err, 'Could not record the payment.'))
                }
              }}
              onMarkPaid={async (playerId: string) => {
                try {
                  await api.markPaymentPaid(matchId, playerId)
                  toast.success('Marked as fully paid.')
                  refreshAll()
                } catch (err) {
                  toast.error(friendlyError(err, 'Could not update the payment.'))
                }
              }}
            />
          </Card>
        </div>
      )}

      {tab === 'activity' && (
        <div className="animate-fade-in">
          <Card>
            <CardHeader
              title="Change history"
              subtitle="Every expense change, adjustment and payment is recorded here."
              icon={<HistoryIcon className="h-4 w-4" />}
            />
            <AuditTrail
              entries={audit.data ?? []}
              loading={audit.loading}
              players={players.data ?? []}
            />
          </Card>
        </div>
      )}

      {/* ------------------------- Confirm dialogs ---------------------- */}
      <ConfirmDialog
        open={closeOpen}
        title="Close voting and finalize the split?"
        message={
          <div className="space-y-2">
            <p>
              {counts.yes} player{counts.yes === 1 ? '' : 's'} confirmed. The{' '}
              {formatCurrency(data.total_expense)} total will be split
              {counts.yes > 0 ? (
                <>
                  {' '}
                  into <strong>{formatCurrency(perPlayerNow)}</strong> each
                </>
              ) : (
                <> — but nobody has confirmed yet</>
              )}
              .
            </p>
            <p className="text-coal-400">
              Players will no longer be able to change their vote. You can reopen voting afterwards
              if you need to.
            </p>
          </div>
        }
        confirmLabel="Close voting"
        loading={busy}
        onConfirm={() => void handleCloseVoting()}
        onCancel={() => setCloseOpen(false)}
      />

      <ConfirmDialog
        open={reopenOpen}
        title="Reopen voting?"
        message="Players will be able to change their vote again. Contributions stay as they are until you recalculate the split."
        confirmLabel="Reopen voting"
        loading={busy}
        onConfirm={() => void handleReopenVoting()}
        onCancel={() => setReopenOpen(false)}
      />
    </div>
  )
}
