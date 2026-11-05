import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarX, Plus } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useAsyncData } from '../hooks/useAsyncData'
import { useRealtime } from '../hooks/useRealtime'
import { supabase } from '../lib/supabase'
import * as api from '../lib/api'
import type { MatchVoteSummary, VoteValue } from '../lib/database.types'
import { cn } from '../lib/cn'
import { PageHeader } from '../components/layout/PageHeader'
import { Button } from '../components/ui/Button'
import { Alert, CardSkeleton, EmptyState } from '../components/ui/Misc'
import { MatchCard } from '../components/match/MatchCard'

type Tab = 'upcoming' | 'past'

export default function Matches() {
  const { profile, isAdmin } = useAuth()
  const [tab, setTab] = useState<Tab>('upcoming')

  const matches = useAsyncData(() => api.fetchMatches({ when: tab }), [tab])

  const summaries = useAsyncData(async () => {
    const { data, error } = await supabase.from('match_vote_summary').select('*')
    if (error) throw error
    return data as MatchVoteSummary[]
  }, [])

  const myVotes = useAsyncData(async () => {
    if (!profile) return []
    const { data, error } = await supabase
      .from('match_votes')
      .select('match_id, vote')
      .eq('player_id', profile.id)
    if (error) throw error
    return data as Array<{ match_id: string; vote: VoteValue }>
  }, [profile?.id])

  const refresh = useCallback(() => {
    void matches.refresh()
    void summaries.refresh()
    void myVotes.refresh()
  }, [matches, summaries, myVotes])

  useRealtime('matches-list', [{ table: 'matches' }, { table: 'match_votes' }], refresh)

  const summaryById = useMemo(() => {
    const map = new Map<string, MatchVoteSummary>()
    for (const s of summaries.data ?? []) map.set(s.match_id, s)
    return map
  }, [summaries.data])

  const voteById = useMemo(() => {
    const map = new Map<string, VoteValue>()
    for (const v of myVotes.data ?? []) map.set(v.match_id, v.vote)
    return map
  }, [myVotes.data])

  const list = matches.data ?? []

  return (
    <div>
      <PageHeader
        title="Matches"
        subtitle="Vote for upcoming fixtures and review what the squad decided."
        action={
          isAdmin ? (
            <Link to="/create-match" className="hidden lg:block">
              <Button icon={<Plus className="h-4 w-4" />}>New match</Button>
            </Link>
          ) : undefined
        }
      />

      <div className="mb-4 inline-flex rounded-xl border border-coal-800 bg-coal-900/70 p-1">
        {(['upcoming', 'past'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              'rounded-lg px-4 py-1.5 text-sm font-semibold capitalize transition-colors',
              tab === t ? 'bg-pitch-600 text-white shadow-sm' : 'text-coal-400 hover:text-coal-200'
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {matches.error && <Alert tone="danger" className="mb-4">{matches.error}</Alert>}

      {matches.loading && list.length === 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <CardSkeleton rows={3} />
          <CardSkeleton rows={3} />
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          icon={<CalendarX className="h-5 w-5" />}
          title={tab === 'upcoming' ? 'No upcoming matches' : 'No past matches'}
          description={
            tab === 'upcoming'
              ? isAdmin
                ? 'Publish a fixture so the squad can start voting.'
                : 'Nothing scheduled yet — your admin will publish the next match soon.'
              : 'Completed matches will be listed here with their final splits.'
          }
          action={
            tab === 'upcoming' && isAdmin ? (
              <Link to="/create-match">
                <Button icon={<Plus className="h-4 w-4" />}>Create a match</Button>
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {list.map((match) => (
            <MatchCard
              key={match.id}
              match={match}
              votes={summaryById.get(match.id) ?? null}
              myVote={voteById.get(match.id) ?? null}
            />
          ))}
        </div>
      )}
    </div>
  )
}
