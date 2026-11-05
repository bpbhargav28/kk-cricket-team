import { Link } from 'react-router-dom'
import { CalendarDays, Clock, IndianRupee, MapPin, Users } from 'lucide-react'
import type { Match, MatchVoteSummary } from '../../lib/database.types'
import { MATCH_STATUS_STYLES } from '../../lib/constants'
import {
  formatCurrencyShort,
  formatMatchDate,
  formatMatchTime,
  formatRelative,
  toNumber,
} from '../../lib/format'
import { Badge } from '../ui/Misc'
import { VotePills } from './VotePills'

interface MatchCardProps {
  match: Match
  votes?: Pick<MatchVoteSummary, 'yes_count' | 'no_count' | 'maybe_count'> | null
  /** The signed-in player's own vote, rendered as a reminder chip. */
  myVote?: 'yes' | 'no' | 'maybe' | null
  perPlayer?: number | null
}

export function MatchCard({ match, votes, myVote, perPlayer }: MatchCardProps) {
  const status = MATCH_STATUS_STYLES[match.status]
  const yes = votes?.yes_count ?? 0
  const share =
    perPlayer ?? (yes > 0 ? toNumber(match.total_expense) / yes : toNumber(match.total_expense))

  const votingClosed =
    !match.voting_open ||
    match.status !== 'upcoming' ||
    (match.voting_deadline ? new Date(match.voting_deadline) < new Date() : false)

  return (
    <Link
      to={`/matches/${match.id}`}
      className="card card-hover block overflow-hidden p-0 focus-visible:ring-2"
    >
      {/* Accent strip */}
      <div
        className={
          match.status === 'cancelled'
            ? 'h-1 bg-gradient-to-r from-rose-700 to-rose-500'
            : match.status === 'completed'
              ? 'h-1 bg-coal-700'
              : 'h-1 bg-pitch-gradient'
        }
      />

      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate font-display text-lg font-semibold tracking-wide text-white">
              {match.title}
            </h3>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-coal-400">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-coal-500" />
              <span className="truncate">{match.location}</span>
            </p>
          </div>
          <Badge className={status.className}>{status.label}</Badge>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2.5 text-sm sm:grid-cols-4">
          <Detail icon={<CalendarDays className="h-3.5 w-3.5" />} label="Date">
            {formatMatchDate(match.match_date)}
          </Detail>
          <Detail icon={<Clock className="h-3.5 w-3.5" />} label="Time">
            {formatMatchTime(match.match_time)}
          </Detail>
          <Detail icon={<IndianRupee className="h-3.5 w-3.5" />} label="Total">
            {formatCurrencyShort(match.total_expense)}
          </Detail>
          <Detail icon={<Users className="h-3.5 w-3.5" />} label="Per player">
            {yes > 0 ? formatCurrencyShort(share) : '—'}
          </Detail>
        </div>

        {votes && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-coal-800/80 pt-3.5">
            <VotePills
              yes={votes.yes_count}
              no={votes.no_count}
              maybe={votes.maybe_count}
              size="sm"
            />
            {match.status === 'upcoming' && (
              <span className="text-xs font-medium text-coal-500">
                {votingClosed
                  ? 'Voting closed'
                  : match.voting_deadline
                    ? `Voting closes ${formatRelative(match.voting_deadline)}`
                    : 'Voting open'}
              </span>
            )}
          </div>
        )}

        {myVote && (
          <p className="mt-3 text-xs text-coal-500">
            Your vote:{' '}
            <span
              className={
                myVote === 'yes'
                  ? 'font-semibold text-pitch-400'
                  : myVote === 'no'
                    ? 'font-semibold text-rose-400'
                    : 'font-semibold text-amber-400'
              }
            >
              {myVote === 'yes' ? 'Available' : myVote === 'no' ? 'Not available' : 'Not sure'}
            </span>
          </p>
        )}
      </div>
    </Link>
  )
}

function Detail({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-coal-500">
        {icon}
        {label}
      </p>
      <p className="mt-0.5 truncate font-medium text-coal-100">{children}</p>
    </div>
  )
}
