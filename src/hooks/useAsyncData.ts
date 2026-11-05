import { useCallback, useEffect, useRef, useState } from 'react'
import { friendlyError } from '../lib/errors'

export interface AsyncData<T> {
  data: T | null
  loading: boolean
  error: string | null
  /** Refetch without clearing the current data (no UI flash). */
  refresh: () => Promise<void>
  /** Local optimistic update. */
  mutate: (updater: (current: T | null) => T | null) => void
}

/**
 * Minimal fetch-with-state helper. Deliberately not react-query: this app has a
 * handful of screens and pulling in a cache library would be more code than it
 * saves. Stale responses are discarded by sequence number.
 */
export function useAsyncData<T>(
  fetcher: () => Promise<T>,
  deps: unknown[],
  options: { enabled?: boolean } = {}
): AsyncData<T> {
  const { enabled = true } = options
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)

  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const seq = useRef(0)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const run = useCallback(
    async (showSpinner: boolean) => {
      if (!enabled) {
        setLoading(false)
        return
      }
      const mySeq = seq.current + 1
      seq.current = mySeq
      if (showSpinner) setLoading(true)

      try {
        const result = await fetcherRef.current()
        if (!mountedRef.current || seq.current !== mySeq) return
        setData(result)
        setError(null)
      } catch (err) {
        if (!mountedRef.current || seq.current !== mySeq) return
        setError(friendlyError(err, 'Could not load this data.'))
      } finally {
        if (mountedRef.current && seq.current === mySeq) setLoading(false)
      }
    },
    [enabled]
  )

  useEffect(() => {
    void run(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, ...deps])

  const refresh = useCallback(() => run(false), [run])

  const mutate = useCallback((updater: (current: T | null) => T | null) => {
    setData((current) => updater(current))
  }, [])

  return { data, loading, error, refresh, mutate }
}
