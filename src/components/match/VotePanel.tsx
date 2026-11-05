import { useState } from 'react'
import { Check, Lock, Vote } from 'lucide-react'
import type { VoteValue } from '../../lib/database.types'
import { VOTE_OPTIONS, VOTE_STYLES } from '../../lib/constants'
import { cn } from '../../lib/cn'
import { formatRelative } from '../../lib/format'
import { Alert } from '../ui/Misc'

interface VotePanelProps {
  myVote: VoteValue | null
  votingOpen: boolean
  closedReason?: string
  deadline?: string | null
  onVote: (vote: VoteValue) => Promise<void>
}

export function VotePanel({ myVote, votingOpen, closedReason, deadline, onVote }: VotePanelProps) {
  const [pending, setPending] = useState<VoteValue | null>(null)

  async function handleClick(vote: VoteValue) {
    if (!votingOpen || pending) return
    setPending(vote)
    try {
      await onVote(vote)
    } finally {
      setPending(null)
    }
  }

  if (!votingOpen) {
    return (
      <div>
        <Header myVote={myVote} />
        <Alert tone="warning" icon={<Lock className="h-4 w-4" />} className="mt-3">
          {closedReason ?? 'Voting for this match is closed.'}
          {myVote && (
            <>
              {' '}
              Your final vote was{' '}
              <strong className="font-semibold">{VOTE_STYLES[myVote].label.toLowerCase()}</strong>.
            </>
          )}
        </Alert>
      </div>
    )
  }

  return (
    <div>
      <Header myVote={myVote} />

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {VOTE_OPTIONS.map((option) => {
          const selected = myVote === option.value
          const styles = VOTE_STYLES[option.value]
          const isPending = pending === option.value

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => handleClick(option.value)}
              disabled={pending !== null}
              aria-pressed={selected}
              className={cn(
                'relative flex items-center justify-between gap-2 rounded-xl border px-4 py-3 text-left transition-all duration-150',
                'active:scale-[0.98] disabled:cursor-wait disabled:opacity-80',
                selected ? styles.active : styles.chip,
                isPending && 'animate-pulse'
              )}
            >
              <span className="min-w-0">
                <span className="block font-display text-base font-semibold uppercase tracking-wide">
                  {option.short}
                </span>
                <span
                  className={cn(
                    'block text-xs',
                    selected ? 'opacity-80' : 'text-coal-500'
                  )}
                >
                  {option.description}
                </span>
              </span>
              {selected && <Check className="h-5 w-5 shrink-0" aria-hidden />}
            </button>
          )
        })}
      </div>

      <p className="mt-3 text-xs text-coal-500">
        {myVote
          ? 'You can change your vote any time until voting closes.'
          : 'Tap an option to register your attendance.'}
        {deadline && <> Voting closes {formatRelative(deadline)}.</>}
      </p>
    </div>
  )
}

function Header({ myVote }: { myVote: VoteValue | null }) {
  return (
    <div className="flex items-center gap-2">
      <Vote className="h-4 w-4 text-pitch-400" />
      <h3 className="section-title">Your attendance</h3>
      {myVote && (
        <span
          className={cn(
            'ml-auto inline-flex items-center gap-1.5 text-xs font-semibold',
            VOTE_STYLES[myVote].text
          )}
        >
          <span className={cn('h-1.5 w-1.5 rounded-full', VOTE_STYLES[myVote].dot)} />
          {VOTE_STYLES[myVote].label}
        </span>
      )}
    </div>
  )
}
