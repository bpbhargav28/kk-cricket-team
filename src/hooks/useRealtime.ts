import { useEffect, useRef } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

export interface RealtimeSubscription {
  table: 'matches' | 'match_votes' | 'player_contributions' | 'payments' | 'profiles'
  /** Postgres filter, e.g. `match_id=eq.<uuid>`. */
  filter?: string
}

/**
 * Subscribes to Supabase Realtime and calls `onChange` when any of the given
 * tables change.
 *
 * Bursts are coalesced into one callback per ~250 ms: closing voting on a match
 * rewrites every contribution and payment row at once, which would otherwise
 * trigger dozens of refetches.
 */
export function useRealtime(
  channelName: string,
  subscriptions: RealtimeSubscription[],
  onChange: () => void,
  enabled = true
): void {
  const handler = useRef(onChange)
  handler.current = onChange

  // Stable key so re-renders with a fresh array literal do not resubscribe.
  const key = subscriptions.map((s) => `${s.table}:${s.filter ?? '*'}`).join('|')

  useEffect(() => {
    if (!enabled || !isSupabaseConfigured || subscriptions.length === 0) return

    let timer: ReturnType<typeof setTimeout> | null = null
    const schedule = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => handler.current(), 250)
    }

    const channel = supabase.channel(channelName)
    for (const sub of key.split('|')) {
      const [table, filter] = sub.split(/:(.*)/s)
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          ...(filter && filter !== '*' ? { filter } : {}),
        },
        schedule
      )
    }

    channel.subscribe()

    return () => {
      if (timer) clearTimeout(timer)
      void supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelName, key, enabled])
}
