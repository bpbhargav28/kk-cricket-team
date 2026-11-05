import { useCallback, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  CalendarDays,
  ChevronDown,
  CircleDollarSign,
  HandCoins,
  History as HistoryIcon,
  MapPin,
  Trophy,
  Users,
} from 'lucide-react'
import { useAsyncData } from '../hooks/useAsyncData'
import { useRealtime } from '../hooks/useRealtime'
import * as api from '../lib/api'
import type { Match, MatchPaymentSummary, MatchVoteSummary } from '../lib/database.types'
import { MATCH_STATUS_STYLES, PAYMENT_STATUS_STYLES } from '../lib/constants'
import { cn } from '../lib/cn'
import { formatCurrency, formatCurrencyShort, formatMatchDate, formatMatchTime, toNumber } from '../lib/format'
import { PageHeader } from '../components/layout/PageHeader'
import { Card, CardHeader } from '../components/ui/Card'
import { Alert, Badge, CardSkeleton, EmptyState, ProgressBar, StatCard } from '../components/ui/Misc'

/**
 * §9 — one row per played match with attendance, total expense, per-player
 * contribution and the payment collection summary, expandable in place.
 */
export default function History() {
  const [expanded, setExpanded] = useState<string | null>(null)

  const matches = useAsyncData(() => api.fetchMatches({ when: 'past' }), [])
  const summaries = useAsyncData(() => api.fetchPaymentSummaries(), [])
  const voteSummaries = useAsyncData(() => api.fetchVoteSummaries(), [])

  const refresh = useCallback(() => {
    void matches.refresh()
    void summaries.refresh()
    void voteSummaries.refresh()
  }, [matches, summaries, voteSummaries])

  useRealtime('history', [{ table: 'matches' }, { table: 'payments' }], refresh)

  const payById = useMemo(() => {
    const map = new Map<string, MatchPaymentSummary>()
    for (const s of summaries.data ?? []) map.set(s.match_id, s)
    return map
  }, [summaries.data])

  const votesById = useMemo(() => {
    const map = new Map<string, MatchVoteSummary>()
    for (const v of voteSummaries.data ?? []) map.set(v.match_id, v)
    return map
  }, [voteSummaries.data])

  const list = matches.data ?? []

  const totals = useMemo(() => {
    let expense = 0
    let collected = 0
    let outstanding = 0
    let attendance = 0
    let counted = 0

    for (const m of list) {
      if (m.status === 'cancelled') continue
      expense += toNumber(m.total_expense)
      const s = payById.get(m.id)
      if (s) {
        collected += toNumber(s.total_collected)
        outstanding += toNumber(s.outstanding)
      }
      const v = votesById.get(m.id)
      if (v) {
        attendance += v.yes_count
        counted += 1
      }
    }

    return {
      played: list.filter((m) => m.status !== 'cancelled').length,
      expense,
      collected,
      outstanding,
      avgAttendance: counted > 0 ? Math.round((attendance / counted) * 10) / 10 : 0,
    }
  }, [list, payById, votesById])

  const loading = matches.loading && !matches.data

  return (
    <div className="space-y-5">
      <PageHeader
        title="Match history"
        subtitle="Every match the team has played, with attendance and the money collected."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Matches played"
          value={String(totals.played)}
          icon={<Trophy className="h-4 w-4" />}
          tone="green"
        />
        <StatCard
          label="Avg attendance"
          value={totals.avgAttendance > 0 ? String(totals.avgAttendance) : '—'}
          icon={<Users className="h-4 w-4" />}
          sublabel="Confirmed players per match"
        />
        <StatCard
          label="Total spent"
          value={formatCurrencyShort(totals.expense)}
          icon={<CircleDollarSign className="h-4 w-4" />}
        />
        <StatCard
          label="Still to collect"
          value={formatCurrencyShort(totals.outstanding)}
          icon={<HandCoins className="h-4 w-4" />}
          tone={totals.outstanding > 0 ? 'rose' : 'green'}
          sublabel={`${formatCurrencyShort(totals.collected)} collected`}
        />
      </div>

      {matches.error && <Alert tone="danger">{matches.error}</Alert>}

      <Card>
        <CardHeader
          title="Previous matches"
          subtitle="Tap a match to see the attendance and collection breakdown."
          icon={<HistoryIcon className="h-4 w-4" />}
        />

        {loading ? (
          <div className="space-y-3">
            <CardSkeleton rows={2} />
            <CardSkeleton rows={2} />
          </div>
        ) : list.length === 0 ? (
          <EmptyState
            icon={<HistoryIcon className="h-5 w-5" />}
            title="No past matches yet"
            description="Once a match date has passed it moves here automatically, with its full attendance and payment record."
          />
        ) : (
          <ul className="space-y-2">
            {list.map((match) => (
              <HistoryRow
                key={match.id}
                match={match}
                payment={payById.get(match.id) ?? null}
                votes={votesById.get(match.id) ?? null}
                open={expanded === match.id}
                onToggle={() => setExpanded(expanded === match.id ? null : match.id)}
              />
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

/* -------------------------------------------------------------------------- */

function HistoryRow({
  match,
  payment,
  votes,
  open,
  onToggle,
}: {
  match: Match
  payment: MatchPaymentSummary | null
  votes: MatchVoteSummary | null
  open: boolean
  onToggle: () => void
}) {
  const status = MATCH_STATUS_STYLES[match.status]
  const total = toNumber(match.total_expense)
  const attending = votes?.yes_count ?? 0
  const perPlayer = payment && payment.contributors > 0
    ? toNumber(payment.total_due) / payment.contributors
    : attending > 0
      ? total / attending
      : 0
  const collected = toNumber(payment?.total_collected ?? 0)
  const outstanding = toNumber(payment?.outstanding ?? 0)
  const due = toNumber(payment?.total_due ?? 0)

  return (
    <li className="overflow-hidden rounded-xl border border-coal-800 bg-coal-925/60">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-coal-900/70"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-display text-base font-semibold text-coal-50">
              {match.title}
            </p>
            {match.status !== 'completed' && (
              <Badge className={status.className}>{status.label}</Badge>
            )}
          </div>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-coal-500">
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3 w-3" />
              {formatMatchDate(match.match_date)}
            </span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {match.location}
            </span>
            <span className="inline-flex items-center gap-1">
              <Users className="h-3 w-3" />
              {attending} attended
            </span>
          </p>
        </div>

        <div className="hidden text-right sm:block">
          <p className="font-display text-base font-bold tabular-nums text-white">
            {formatCurrencyShort(total)}
          </p>
          <p className="text-[10px] uppercase tracking-wider text-coal-500">
            {perPlayer > 0 ? `${formatCurrency(perPlayer)} each` : 'Not split'}
          </p>
        </div>

        {payment && (
          <Badge
            className={
              outstanding > 0
                ? PAYMENT_STATUS_STYLES.partially_paid.className
                : PAYMENT_STATUS_STYLES.paid.className
            }
          >
            {outstanding > 0 ? `${formatCurrencyShort(outstanding)} due` : 'Settled'}
          </Badge>
        )}

        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-coal-500 transition-transform',
            open && 'rotate-180'
          )}
        />
      </button>

      {open && (
        <div className="animate-slide-down border-t border-coal-800 px-4 py-4">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
            <Detail label="Date & time">
              {formatMatchDate(match.match_date)}, {formatMatchTime(match.match_time)}
            </Detail>
            <Detail label="Ground">{match.location}</Detail>
            <Detail label="Attendance">
              {attending} yes · {votes?.no_count ?? 0} no · {votes?.maybe_count ?? 0} maybe
            </Detail>
            <Detail label="Total expense">{formatCurrency(total)}</Detail>
            <Detail label="Per player">
              {perPlayer > 0 ? formatCurrency(perPlayer) : '—'}
            </Detail>
            <Detail label="Assigned">{formatCurrency(due)}</Detail>
            <Detail label="Collected" tone="text-pitch-300">
              {formatCurrency(collected)}
            </Detail>
            <Detail label="Outstanding" tone={outstanding > 0 ? 'text-rose-300' : 'text-pitch-300'}>
              {formatCurrency(outstanding)}
            </Detail>
          </dl>

          {payment && due > 0 && (
            <div className="mt-4">
              <ProgressBar
                value={collected}
                max={due}
                tone={outstanding > 0 ? 'amber' : 'green'}
                label={`Collection for ${match.title}`}
              />
              <p className="mt-1.5 text-xs text-coal-500">
                {payment.paid_count} of {payment.contributors} players paid in full
                {payment.partially_paid_count > 0 && `, ${payment.partially_paid_count} partially`}
                {payment.pending_count > 0 && `, ${payment.pending_count} pending`}.
              </p>
            </div>
          )}

          {match.status === 'cancelled' && match.cancellation_reason && (
            <Alert tone="danger" className="mt-4">
              Cancelled — {match.cancellation_reason}
            </Alert>
          )}

          <Link
            to={`/matches/${match.id}`}
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-pitch-400 transition-colors hover:text-pitch-300"
          >
            Open full match record
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </li>
  )
}

function Detail({
  label,
  children,
  tone,
}: {
  label: string
  children: ReactNode
  tone?: string
}) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-coal-600">{label}</dt>
      <dd className={cn('mt-0.5 text-sm font-medium text-coal-200', tone)}>{children}</dd>
    </div>
  )
}
