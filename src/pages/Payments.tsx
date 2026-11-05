import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CircleDollarSign, HandCoins, TrendingDown, Wallet } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useAsyncData } from '../hooks/useAsyncData'
import { useRealtime } from '../hooks/useRealtime'
import * as api from '../lib/api'
import { PAYMENT_STATUS_STYLES } from '../lib/constants'
import { cn } from '../lib/cn'
import { formatCurrency, formatCurrencyShort, formatDateTime, formatMatchDate, toNumber } from '../lib/format'
import { PageHeader } from '../components/layout/PageHeader'
import { Card, CardHeader } from '../components/ui/Card'
import { Alert, Badge, CardSkeleton, EmptyState, ProgressBar, StatCard } from '../components/ui/Misc'

type Tab = 'mine' | 'team'

/**
 * Players land on "My payments" (their own records only — RLS enforces it).
 * Admins get the team-wide collection view, built from the aggregate-only
 * match_payment_summary view.
 */
export default function Payments() {
  const { profile, isAdmin } = useAuth()
  const [tab, setTab] = useState<Tab>(isAdmin ? 'team' : 'mine')

  const mine = useAsyncData(
    () => (profile ? api.fetchMyPayments(profile.id) : Promise.resolve([])),
    [profile?.id]
  )
  const summaries = useAsyncData(() => api.fetchPaymentSummaries(), [])

  const refresh = useCallback(() => {
    void mine.refresh()
    void summaries.refresh()
  }, [mine, summaries])

  useRealtime('payments', [{ table: 'payments' }, { table: 'matches' }], refresh)

  const myTotals = useMemo(() => {
    const list = mine.data ?? []
    const due = list.reduce((s, p) => s + toNumber(p.amount_due), 0)
    const paid = list.reduce((s, p) => s + toNumber(p.amount_paid), 0)
    return {
      due,
      paid,
      outstanding: Math.max(due - paid, 0),
      pendingCount: list.filter((p) => p.status !== 'paid').length,
      matchCount: list.length,
    }
  }, [mine.data])

  const teamTotals = useMemo(() => {
    const list = summaries.data ?? []
    return {
      expense: list.reduce((s, m) => s + toNumber(m.total_expense), 0),
      collected: list.reduce((s, m) => s + toNumber(m.total_collected), 0),
      outstanding: list.reduce((s, m) => s + toNumber(m.outstanding), 0),
      matchesWithDues: list.filter((m) => toNumber(m.outstanding) > 0).length,
    }
  }, [summaries.data])

  return (
    <div className="space-y-5">
      <PageHeader
        title="Payments"
        subtitle={
          isAdmin
            ? 'Track what the team owes and what has been collected, match by match.'
            : 'Your match contributions and payment history.'
        }
      />

      {isAdmin && (
        <div className="inline-flex rounded-xl border border-coal-800 bg-coal-900/70 p-1">
          {([
            { id: 'team' as Tab, label: 'Team collection' },
            { id: 'mine' as Tab, label: 'My payments' },
          ]).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                'rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors',
                tab === t.id ? 'bg-pitch-600 text-white' : 'text-coal-400 hover:text-coal-200'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* ----------------------------- My payments ---------------------- */}
      {tab === 'mine' && (
        <div className="space-y-5 animate-fade-in">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="Total contributed"
              value={formatCurrencyShort(myTotals.paid)}
              icon={<HandCoins className="h-4 w-4" />}
              tone="green"
              sublabel={`Across ${myTotals.matchCount} match${myTotals.matchCount === 1 ? '' : 'es'}`}
            />
            <StatCard
              label="You owe"
              value={formatCurrencyShort(myTotals.outstanding)}
              icon={<TrendingDown className="h-4 w-4" />}
              tone={myTotals.outstanding > 0 ? 'rose' : 'green'}
              sublabel={
                myTotals.pendingCount > 0
                  ? `${myTotals.pendingCount} match${myTotals.pendingCount === 1 ? '' : 'es'} pending`
                  : 'All settled'
              }
            />
            <StatCard
              label="Total assigned"
              value={formatCurrencyShort(myTotals.due)}
              icon={<CircleDollarSign className="h-4 w-4" />}
            />
            <StatCard
              label="Settled matches"
              value={String(myTotals.matchCount - myTotals.pendingCount)}
              icon={<Wallet className="h-4 w-4" />}
              tone="green"
            />
          </div>

          {mine.error && <Alert tone="danger">{mine.error}</Alert>}

          <Card>
            <CardHeader
              title="Payment history"
              subtitle="Newest first. Only an admin can mark a payment as received."
              icon={<Wallet className="h-4 w-4" />}
            />

            {mine.loading && !mine.data ? (
              <CardSkeleton rows={3} />
            ) : (mine.data ?? []).length === 0 ? (
              <EmptyState
                icon={<Wallet className="h-5 w-5" />}
                title="No payment records yet"
                description="Once you vote “Yes” for a match and the admin calculates the split, your contribution shows up here."
              />
            ) : (
              <ul className="divide-y divide-coal-800 overflow-hidden rounded-xl border border-coal-800">
                {(mine.data ?? []).map((p) => {
                  const style = PAYMENT_STATUS_STYLES[p.status]
                  const remaining = Math.max(toNumber(p.amount_due) - toNumber(p.amount_paid), 0)

                  return (
                    <li key={p.id} className="bg-coal-925/60 px-4 py-3">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                        <div className="min-w-0 flex-1">
                          <Link
                            to={`/matches/${p.match_id}`}
                            className="truncate text-sm font-semibold text-coal-100 hover:text-pitch-300"
                          >
                            {p.match?.title ?? 'Match'}
                          </Link>
                          <p className="mt-0.5 text-xs text-coal-500">
                            {p.match ? formatMatchDate(p.match.match_date) : '—'}
                            {p.match?.location && <> · {p.match.location}</>}
                            {p.payment_date && <> · Paid {formatDateTime(p.payment_date)}</>}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-display text-base font-bold tabular-nums text-white">
                            {formatCurrency(p.amount_due)}
                          </p>
                          <p className="text-[10px] uppercase tracking-wider text-coal-500">Due</p>
                        </div>
                        <Badge className={style.className}>{style.label}</Badge>
                      </div>

                      {p.status !== 'paid' && (
                        <div className="mt-2">
                          <ProgressBar
                            value={toNumber(p.amount_paid)}
                            max={Math.max(toNumber(p.amount_due), 1)}
                            tone="amber"
                            label="Payment progress"
                          />
                          <p className="mt-1 text-xs text-coal-500">
                            {formatCurrency(p.amount_paid)} paid ·{' '}
                            <span className="font-semibold text-rose-300">
                              {formatCurrency(remaining)} remaining
                            </span>
                          </p>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>
        </div>
      )}

      {/* --------------------------- Team collection -------------------- */}
      {tab === 'team' && isAdmin && (
        <div className="space-y-5 animate-fade-in">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="All-time expense"
              value={formatCurrencyShort(teamTotals.expense)}
              icon={<CircleDollarSign className="h-4 w-4" />}
            />
            <StatCard
              label="Collected"
              value={formatCurrencyShort(teamTotals.collected)}
              icon={<HandCoins className="h-4 w-4" />}
              tone="green"
            />
            <StatCard
              label="Outstanding"
              value={formatCurrencyShort(teamTotals.outstanding)}
              icon={<TrendingDown className="h-4 w-4" />}
              tone={teamTotals.outstanding > 0 ? 'rose' : 'green'}
            />
            <StatCard
              label="Matches with dues"
              value={String(teamTotals.matchesWithDues)}
              icon={<Wallet className="h-4 w-4" />}
              tone={teamTotals.matchesWithDues > 0 ? 'amber' : 'green'}
            />
          </div>

          {summaries.error && <Alert tone="danger">{summaries.error}</Alert>}

          <Card>
            <CardHeader
              title="Collection by match"
              subtitle="Open a match to mark payments as received."
              icon={<Wallet className="h-4 w-4" />}
            />

            {summaries.loading && !summaries.data ? (
              <CardSkeleton rows={4} />
            ) : (summaries.data ?? []).length === 0 ? (
              <EmptyState
                icon={<Wallet className="h-5 w-5" />}
                title="No matches yet"
                description="Create a match and the collection summary will appear here."
              />
            ) : (
              <ul className="divide-y divide-coal-800 overflow-hidden rounded-xl border border-coal-800">
                {(summaries.data ?? []).map((s) => {
                  const outstanding = toNumber(s.outstanding)
                  return (
                    <li key={s.match_id} className="bg-coal-925/60 px-4 py-3">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                        <div className="min-w-0 flex-1">
                          <Link
                            to={`/matches/${s.match_id}`}
                            className="inline-flex items-center gap-1 truncate text-sm font-semibold text-coal-100 hover:text-pitch-300"
                          >
                            {s.title}
                            <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-60" />
                          </Link>
                          <p className="mt-0.5 text-xs text-coal-500">
                            {formatMatchDate(s.match_date)} · {s.contributors} contributors ·{' '}
                            {s.paid_count} paid, {s.pending_count + s.partially_paid_count} pending
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-display text-base font-bold tabular-nums text-white">
                            {formatCurrency(s.total_collected)}
                          </p>
                          <p className="text-[10px] uppercase tracking-wider text-coal-500">
                            of {formatCurrencyShort(s.total_due)}
                          </p>
                        </div>
                        <Badge
                          className={
                            outstanding > 0
                              ? PAYMENT_STATUS_STYLES.pending.className
                              : PAYMENT_STATUS_STYLES.paid.className
                          }
                        >
                          {outstanding > 0 ? `${formatCurrencyShort(outstanding)} due` : 'Settled'}
                        </Badge>
                      </div>
                      <div className="mt-2">
                        <ProgressBar
                          value={toNumber(s.total_collected)}
                          max={Math.max(toNumber(s.total_due), 1)}
                          tone={outstanding > 0 ? 'amber' : 'green'}
                          label={`Collection for ${s.title}`}
                        />
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}
