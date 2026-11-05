import { CircleSlash, HelpCircle, UserCheck, Users } from 'lucide-react'
import type { Profile, VoteValue, VoteWithPlayer } from '../../lib/database.types'
import { VOTE_STYLES } from '../../lib/constants'
import { cn } from '../../lib/cn'
import { pluralise } from '../../lib/format'
import { Avatar, ProgressBar } from '../ui/Misc'

interface VoteResultsProps {
  votes: VoteWithPlayer[]
  /** Active roster, used to show who has not voted yet. */
  players: Profile[]
  currentPlayerId?: string
}

const GROUPS: Array<{
  vote: VoteValue
  title: string
  icon: typeof UserCheck
}> = [
  { vote: 'yes', title: 'Available', icon: UserCheck },
  { vote: 'maybe', title: 'Not sure', icon: HelpCircle },
  { vote: 'no', title: 'Not available', icon: CircleSlash },
]

export function VoteResults({ votes, players, currentPlayerId }: VoteResultsProps) {
  const counts = {
    yes: votes.filter((v) => v.vote === 'yes').length,
    no: votes.filter((v) => v.vote === 'no').length,
    maybe: votes.filter((v) => v.vote === 'maybe').length,
  }
  const totalVotes = votes.length
  const activePlayers = players.filter((p) => p.is_active)
  const votedIds = new Set(votes.map((v) => v.player_id))
  const notVoted = activePlayers.filter((p) => !votedIds.has(p.id))

  return (
    <div className="space-y-5">
      {/* Live totals */}
      <div>
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <p className="text-sm text-coal-400">
            <span className="font-display text-2xl font-bold text-white">{counts.yes}</span>{' '}
            confirmed of {activePlayers.length} players
          </p>
          <p className="text-xs text-coal-500">
            {totalVotes} / {activePlayers.length} voted
          </p>
        </div>
        <ProgressBar
          value={counts.yes}
          max={Math.max(activePlayers.length, 1)}
          label="Confirmed attendance"
        />
      </div>

      {/* Per-category player lists */}
      <div className="space-y-4">
        {GROUPS.map(({ vote, title, icon: Icon }) => {
          const group = votes
            .filter((v) => v.vote === vote)
            .sort((a, b) =>
              (a.player?.full_name ?? '').localeCompare(b.player?.full_name ?? '')
            )
          const styles = VOTE_STYLES[vote]

          return (
            <section key={vote}>
              <div className="mb-2 flex items-center gap-2">
                <Icon className={cn('h-4 w-4', styles.text)} />
                <h3 className={cn('font-display text-sm font-semibold uppercase tracking-wide', styles.text)}>
                  {title}
                </h3>
                <span className="rounded-md bg-coal-800 px-1.5 py-0.5 text-xs font-bold tabular-nums text-coal-300">
                  {group.length}
                </span>
              </div>

              {group.length === 0 ? (
                <p className="pl-6 text-xs text-coal-600">Nobody yet.</p>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {group.map((v) => (
                    <li
                      key={v.id}
                      className={cn(
                        'flex items-center gap-2 rounded-full border border-coal-800 bg-coal-900/70 py-1 pl-1 pr-3',
                        v.player_id === currentPlayerId && 'ring-1 ring-pitch-700/60'
                      )}
                      title={v.note ?? undefined}
                    >
                      <Avatar
                        id={v.player_id}
                        name={v.player?.full_name}
                        url={v.player?.avatar_url}
                        size="xs"
                      />
                      <span className="text-sm font-medium text-coal-200">
                        {v.player?.full_name ?? 'Unknown player'}
                        {v.player_id === currentPlayerId && (
                          <span className="ml-1 text-xs text-pitch-500">(you)</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )
        })}

        {notVoted.length > 0 && (
          <section>
            <div className="mb-2 flex items-center gap-2">
              <Users className="h-4 w-4 text-coal-500" />
              <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-coal-500">
                Yet to vote
              </h3>
              <span className="rounded-md bg-coal-800 px-1.5 py-0.5 text-xs font-bold tabular-nums text-coal-400">
                {notVoted.length}
              </span>
            </div>
            <p className="text-sm leading-relaxed text-coal-500">
              {notVoted.map((p) => p.full_name).join(', ')}
            </p>
            <p className="mt-1 text-xs text-coal-600">
              {pluralise(notVoted.length, 'player has', 'players have')} not responded yet.
            </p>
          </section>
        )}
      </div>
    </div>
  )
}
