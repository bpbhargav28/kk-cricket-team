import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const url = import.meta.env.VITE_SUPABASE_URL
const publishableKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * True when both env vars are present. The app renders a friendly setup screen
 * instead of crashing when they are missing (e.g. a fresh clone, or a Pages
 * deploy whose repository secrets have not been filled in yet).
 */
export const isSupabaseConfigured = Boolean(url && publishableKey)

function createStub(): SupabaseClient<Database> {
  const message =
    'Supabase is not configured. Copy .env.example to .env and fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
  // A Proxy keeps module-level `supabase.from(...)` imports safe to evaluate;
  // only an actual call throws, and ConfigNotice renders before that happens.
  return new Proxy({} as SupabaseClient<Database>, {
    get() {
      throw new Error(message)
    },
  })
}

/**
 * Browser Supabase client.
 *
 * SECURITY: this only ever receives the *publishable* (anon) key, which is
 * designed to be public. Every table is protected by Row Level Security and
 * all privileged operations go through SECURITY DEFINER RPCs that re-check
 * the caller's role in the database. The service-role key must never appear
 * in this repository or in any VITE_* variable — anything prefixed VITE_ is
 * inlined into the JavaScript bundle and therefore world-readable.
 */
export const supabase: SupabaseClient<Database> = isSupabaseConfigured
  ? createClient<Database>(url!, publishableKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
        storageKey: 'kk-cricket-auth',
      },
      realtime: {
        params: { eventsPerSecond: 5 },
      },
      global: {
        headers: { 'x-application-name': 'kk-cricket-team' },
      },
    })
  : createStub()
