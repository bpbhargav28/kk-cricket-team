import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { Alert, PageLoader } from '../ui/Misc'
import { Button } from '../ui/Button'

/** Requires a signed-in team member with a loaded profile. */
export function ProtectedRoute() {
  const { session, profile, loading, profileError, refreshProfile } = useAuth()
  const location = useLocation()

  if (loading) return <PageLoader label="Checking your session…" />

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }

  if (profileError || !profile) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <Alert tone="danger" title="Your profile could not be loaded" icon={<ShieldAlert className="h-5 w-5" />}>
          <p>{profileError ?? 'No profile row exists for your account.'}</p>
          <p className="mt-2 text-xs opacity-80">
            If you have just signed up, give it a moment and retry. If this persists, the database
            migrations in <code className="rounded bg-black/40 px-1">supabase/migrations</code> may
            not have been applied.
          </p>
          <Button className="mt-4" size="sm" variant="secondary" onClick={() => void refreshProfile()}>
            Retry
          </Button>
        </Alert>
      </div>
    )
  }

  if (!profile.is_active) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <Alert tone="warning" title="Your account is deactivated">
          A team admin has deactivated your account, so you cannot vote or view matches. Please ask
          an admin to reactivate it.
        </Alert>
      </div>
    )
  }

  return <Outlet />
}

/**
 * Hides admin screens from players. This is a UX convenience only — the real
 * enforcement is Row Level Security plus the `assert_admin()` check inside
 * every privileged RPC, so a player who forces this route still cannot write.
 */
export function AdminRoute() {
  const { isAdmin, loading } = useAuth()

  if (loading) return <PageLoader />

  if (!isAdmin) {
    return (
      <div className="py-10">
        <Alert tone="danger" title="Admins only" icon={<ShieldAlert className="h-5 w-5" />}>
          This page is restricted to team admins. If you believe you should have access, ask an
          existing admin to promote your account from the Players page.
        </Alert>
      </div>
    )
  }

  return <Outlet />
}

/** Bounces already-signed-in users away from /login and /signup. */
export function PublicOnlyRoute() {
  const { session, loading } = useAuth()
  if (loading) return <PageLoader />
  if (session) return <Navigate to="/" replace />
  return <Outlet />
}
