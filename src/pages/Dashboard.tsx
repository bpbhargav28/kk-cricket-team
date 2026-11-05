import { useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  CalendarDays,
  CalendarX,
  Clock,
  IndianRupee,
  MapPin,
  Plus,
  TrendingDown,
  UserCheck,
  Users,
  UserX,
  Wallet,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useAsyncData } from '../hooks/useAsyncData'
import { useRealtime } from '../hooks/useRealtime'
import * as api from '../lib/api'
import type { VoteValue } from '../lib/database.types'
import { friendlyError } from '../lib/errors'
import {
  formatCurrency,
  formatCurrencyShort,
  formatMatchDate,
  formatMatchTime,
  formatRelative,
  toNumber,
} from '../lib/format'
import { Card, CardHeader } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Alert, Badge, CardSkeleton, EmptyState, Skeleton, StatCard } from '../components/ui/Misc'
import { MatchCard } from '../components/match/MatchCard'
import { VotePanel } from '../components/match/VotePanel'

export default function Dashboard() {
  const { profile, isAdmin } = useAuth()
  const toast = useToast()

  const summary = useAsyncData(() => api.fetchDashboard(), [])
  const recent = useAsyncData(() => api.fetchMatches({ when: 'past' }), [])
  const myPayments = useAsyncData(
    () => (profile ? api.fetchMyPayments(profile.id) : Promise.resolve([])),
    [profile?.id]
  )

  const refreshAll = useCallback(() => {
    void summary.refresh()
    void myPayments.refresh()
  }, [summary, myPayments])

  useRealtime(
    'dashboard',
    [{ table: 'match_votes' }, { table: 'matches' }, { table: 'payments' }],
    refreshAll
  )

  const data = summary.data
  const nextMatch = data?.next_match ?? null
  const firstName = profile?.full_name?.split(' ')[0] ?? 'player'

  const outstanding = myPayments.data?.filter((p) => p.status !== 'paid') ?? []
  const totalOutstanding = outstanding.reduce(
    (sum, p) => sum + Math.max(toNumber(p.amount_due) - toNumber(p.amount_paid), 0),
    0
  )

  async function handleVote(vote: VoteValue) {
    if (!nextMatch || !profile) return
    try {
      await api.castVote(nextMatch.id, profile.id, vote)
      await summary.refresh()
      toast.success(
        vote === 'yes'
          ? "You're in. See you at the ground!"
          : vote === 'no'
            ? "Noted — you're marked as unavailable."
            : "Marked as 'not sure'. Please confirm before voting closes."
      )
    } catch (err) {
      toast.error(friendlyError(err, 'Could not save your vote.'))
    }
  }

  const votingOpen = Boolean(
    nextMatch?.voting_open &&
      nextMatch.status === 'upcoming' &&
      (!nextMatch.voting_deadline || new Date(nextMatch.voting_deadline) > new Date())
  )

  return (
    <div className="space-y-6">
      {/* --------------------------- Welcome ---------------------------- */}
      <div className="animate-fade-in">
        <p className="font-display text-xs font-semibold uppercase tracking-[0.3em] text-pitch-500">
          Welcome to KK Cricket Team
        </p>
        <h1 className="mt-1.5 font-display text-2xl font-bold uppercase tracking-wide text-white sm:text-3xl">
          Howzat, {firstName}!
        </h1>
        <p className="mt-1 text-sm text-coal-400">
          {nextMatch
            ? `Your next match is ${formatRelative(`${nextMatch.match_date}T${nextMatch.match_time}`)}.`
            : 'No match is on the calendar right now.'}
        </p>
      </div>

      {summary.error && <Alert tone="danger">{summary.error}</Alert>}

      {/* --------------------------- Next match ------------------------- */}
      {summary.loading && !data ? (
        <CardSkeleton rows={4} />
      ) : nextMatch ? (
        <Card className="overflow-hidden p-0">
          <div className="h-1 bg-pitch-gradient" />
          <div className="p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <Badge className="bg-pitch-600/20 text-pitch-300 ring-pitch-700/50" dot="bg-pitch-400">
                  Next match
                </Badge>
                <h2 className="mt-2 font-display text-xl font-bold tracking-wide text-white sm:text-2xl">
                  {nextMatch.title}
                </h2>
              </div>
              <Link
                to={`/matches/${nextMatch.id}`}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg text-sm font-semibold text-pitch-400 transition-colors hover:text-pitch-300"
              >
                Match details
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <InfoTile
                icon={<CalendarDays className="h-4 w-4" />}
                label="Date"
                value={formatMatchDate(nextMatch.match_date)}
              />
              <InfoTile
                icon={<Clock className="h-4 w-4" />}
                label="Time"
                value={formatMatchTime(nextMatch.match_time)}
              />
              <InfoTile
                icon={<MapPin className="h-4 w-4" />}
                label="Ground"
                value={nextMatch.location}
              />
              <InfoTile
                icon={<IndianRupee className="h-4 w-4" />}
                label="Total expense"
                value={formatCurrencyShort(nextMatch.total_expense)}
              />
            </dl>

            {nextMatch.description && (
              <p className="mt-4 rounded-xl bg-coal-925/80 p-3 text-sm leading-relaxed text-coal-300">
                {nextMatch.description}
              </p>
            )}

            <div className="mt-5 border-t border-coal-800/80 pt-5">
              <VotePanel
                myVote={data?.my_vote ?? null}
                votingOpen={votingOpen}
                deadline={nextMatch.voting_deadline}
                closedReason={
                  nextMatch.status !== 'upcoming'
                    ? 'This match is no longer open.'
                    : 'The admin has closed voting for this match.'
                }
                onVote={handleVote}
              />
            </div>
          </div>
        </Card>
      ) : (
        <EmptyState
          icon={<CalendarX className="h-5 w-5" />}
          title="No upcoming match"
          description={
            isAdmin
              ? 'Create the next fixture and the squad can start voting right away.'
              : 'Your team admin has not scheduled the next match yet.'
          }
          action={
            isAdmin ? (
              <Link to="/create-match">
                <Button icon={<Plus className="h-4 w-4" />}>Create a match</Button>
              </Link>
            ) : undefined
          }
        />
      )}

      {/* --------------------------- Squad stats ------------------------ */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {summary.loading && !data ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[104px]" />)
        ) : (
          <>
            <StatCard
              label="Registered players"
              value={data?.total_players ?? 0}
              icon={<Users className="h-4 w-4" />}
            />
            <StatCard
              label="Attending"
              value={data?.attending ?? 0}
              icon={<UserCheck className="h-4 w-4" />}
              tone="green"
              sublabel={data?.maybe ? `${data.maybe} not sure` : 'Confirmed “Yes” votes'}
            />
            <StatCard
              label="Not attending"
              value={data?.not_attending ?? 0}
              icon={<UserX className="h-4 w-4" />}
              tone="rose"
            />
            <StatCard
              label="Your contribution"
              value={formatCurrencyShort(
                data?.my_share ?? data?.per_player_estimate ?? 0
              )}
              icon={<IndianRupee className="h-4 w-4" />}
              tone="green"
              sublabel={
                data?.my_share != null
                  ? 'Confirmed share for the next match'
                  : data?.attending
                    ? `Estimate at ${data.attending} confirmed`
                    : 'Vote “Yes” to get your share'
              }
            />
          </>
        )}
      </div>

      {/* ------------------------ Outstanding payments ------------------ */}
      <Card>
        <CardHeader
          title="Your outstanding payments"
          subtitle={
            totalOutstanding > 0
              ? `${formatCurrency(totalOutstanding)} across ${outstanding.length} match${outstanding.length === 1 ? '' : 'es'}`
              : 'Everything is settled — nice one.'
          }
          icon={<Wallet className="h-4 w-4" />}
          action={
            <Link
              to="/payments"
              className="inline-flex items-center gap-1 rounded-lg text-sm font-semibold text-pitch-400 hover:text-pitch-300"
            >
              All payments
              <ArrowRight className="h-4 w-4" />
            </Link>
          }
        />

        {myPayments.loading && !myPayments.data ? (
          <div className="space-y-2">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        ) : outstanding.length === 0 ? (
          <div className="flex items-center gap-3 rounded-xl bg-pitch-950/40 px-4 py-3 ring-1 ring-inset ring-pitch-900/60">
            <TrendingDown className="h-5 w-5 shrink-0 text-pitch-400" />
            <p className="text-sm text-pitch-200">
              No dues pending. All your match contributions are paid up.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-coal-800 overflow-hidden rounded-xl border border-coal-800">
            {outstanding.slice(0, 4).map((p) => (
              <li key={p.id} className="flex items-center gap-3 bg-coal-925/60 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/matches/${p.match_id}`}
                    className="truncate text-sm font-semibold text-coal-100 hover:text-pitch-300"
                  >
                    {p.match?.title ?? 'Match'}
                  </Link>
                  <p className="text-xs text-coal-500">
                    {p.match ? formatMatchDate(p.match.match_date) : '—'}
                    {toNumber(p.amount_paid) > 0 && (
                      <> · {formatCurrency(p.amount_paid)} already paid</>
                    )}
                  </p>
                </div>
                <p className="shrink-0 font-display text-base font-bold tabular-nums text-rose-300">
                  {formatCurrency(Math.max(toNumber(p.amount_due) - toNumber(p.amount_paid), 0))}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* --------------------------- Recent matches --------------------- */}
      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <h2 className="section-title">Recent matches</h2>
          <Link
            to="/history"
            className="inline-flex items-center gap-1 rounded-lg text-sm font-semibold text-pitch-400 hover:text-pitch-300"
          >
            Full history
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {recent.loading && !recent.data ? (
          <div className="space-y-3">
            <CardSkeleton rows={2} />
          </div>
        ) : (recent.data ?? []).length === 0 ? (
          <EmptyState
            icon={<CalendarDays className="h-5 w-5" />}
            title="No matches played yet"
            description="Once a match date passes it shows up here with its final expense split."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {(recent.data ?? []).slice(0, 4).map((match) => (
              <MatchCard key={match.id} match={match} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function InfoTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="min-w-0 rounded-xl bg-coal-925/70 p-3">
      <dt className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-coal-500">
        <span className="text-coal-500">{icon}</span>
        {label}
      </dt>
      <dd className="mt-1 truncate text-sm font-semibold text-coal-50" title={value}>
        {value}
      </dd>
    </div>
  )
}
