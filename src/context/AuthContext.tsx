import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile } from '../lib/database.types'
import { friendlyError } from '../lib/errors'

interface SignUpArgs {
  email: string
  password: string
  fullName: string
  phone?: string
}

interface AuthState {
  session: Session | null
  user: User | null
  profile: Profile | null
  /** True until the initial session + profile fetch settles. */
  loading: boolean
  /** Profile row could not be loaded (e.g. the signup trigger has not run yet). */
  profileError: string | null
  /**
   * Convenience flag for *hiding UI only*. Every privileged operation is
   * re-validated by Row Level Security and SECURITY DEFINER functions in
   * Postgres, so flipping this in devtools grants nothing.
   */
  isAdmin: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (args: SignUpArgs) => Promise<{ needsEmailConfirmation: boolean }>
  signOut: () => Promise<void>
  sendPasswordReset: (email: string) => Promise<void>
  updatePassword: (password: string) => Promise<void>
  updateProfile: (patch: Partial<Pick<Profile, 'full_name' | 'phone' | 'jersey_no'>>) => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileError, setProfileError] = useState<string | null>(null)
  const mounted = useRef(true)

  const loadProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (!mounted.current) return

    if (error) {
      setProfileError(friendlyError(error, 'Could not load your profile.'))
      setProfile(null)
      return
    }

    if (!data) {
      // The on_auth_user_created trigger should have made this row. Retry once
      // after a short delay to cover the race right after signup.
      await new Promise((r) => setTimeout(r, 900))
      const retry = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
      if (!mounted.current) return
      if (retry.data) {
        setProfile(retry.data as Profile)
        setProfileError(null)
        return
      }
      setProfile(null)
      setProfileError(
        'Your profile has not been created yet. Make sure the database migrations have been applied.'
      )
      return
    }

    setProfile(data as Profile)
    setProfileError(null)
  }, [])

  useEffect(() => {
    mounted.current = true

    // onAuthStateChange fires an INITIAL_SESSION event, so a single listener
    // covers both bootstrap and later sign-in/sign-out transitions.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted.current) return
      setSession(nextSession)

      if (!nextSession?.user) {
        setProfile(null)
        setProfileError(null)
        setLoading(false)
        return
      }

      // Token refreshes do not need a profile re-fetch.
      if (event === 'TOKEN_REFRESHED' && profile) {
        setLoading(false)
        return
      }

      // Deferred: the Supabase docs warn against awaiting inside this callback.
      void (async () => {
        await loadProfile(nextSession.user.id)
        if (mounted.current) setLoading(false)
      })()
    })

    return () => {
      mounted.current = false
      subscription.unsubscribe()
    }
    // `profile` is read inside but intentionally not a dependency: re-subscribing
    // on every profile change would drop realtime auth events.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadProfile])

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })
    if (error) throw error
  }, [])

  const signUp = useCallback(async ({ email, password, fullName, phone }: SignUpArgs) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        // full_name/phone are read by the handle_new_user() trigger.
        data: { full_name: fullName.trim(), phone: phone?.trim() || null },
        emailRedirectTo: `${window.location.origin}${import.meta.env.BASE_URL}login`,
      },
    })
    if (error) throw error

    // When email confirmation is enabled Supabase returns a user but no session.
    return { needsEmailConfirmation: Boolean(data.user) && !data.session }
  }, [])

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    setProfile(null)
  }, [])

  const sendPasswordReset = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}reset-password`,
    })
    if (error) throw error
  }, [])

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw error
  }, [])

  const updateProfile = useCallback(
    async (patch: Partial<Pick<Profile, 'full_name' | 'phone' | 'jersey_no'>>) => {
      if (!session?.user) throw new Error('You are not signed in.')
      const { data, error } = await supabase
        .from('profiles')
        .update(patch)
        .eq('id', session.user.id)
        .select()
        .single()
      if (error) throw error
      setProfile(data as Profile)
    },
    [session]
  )

  const refreshProfile = useCallback(async () => {
    if (session?.user) await loadProfile(session.user.id)
  }, [session, loadProfile])

  const value = useMemo<AuthState>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
      profileError,
      isAdmin: profile?.role === 'admin' && profile.is_active,
      signIn,
      signUp,
      signOut,
      sendPasswordReset,
      updatePassword,
      updateProfile,
      refreshProfile,
    }),
    [
      session,
      profile,
      loading,
      profileError,
      signIn,
      signUp,
      signOut,
      sendPasswordReset,
      updatePassword,
      updateProfile,
      refreshProfile,
    ]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
