import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { LogOut, Plus, ShieldCheck, User as UserIcon } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { cn } from '../../lib/cn'
import { friendlyError } from '../../lib/errors'
import { Avatar, Badge } from '../ui/Misc'
import { Button } from '../ui/Button'
import { ConfirmDialog } from '../ui/Modal'
import { Logo, LogoMark } from './Logo'
import { NAV_ITEMS, isNavActive } from './navigation'

export function AppShell() {
  const { profile, isAdmin, signOut } = useAuth()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const toast = useToast()
  const [signOutOpen, setSignOutOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  const items = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin)

  async function handleSignOut() {
    setSigningOut(true)
    try {
      await signOut()
      navigate('/login', { replace: true })
    } catch (err) {
      toast.error(friendlyError(err, 'Could not sign out.'))
    } finally {
      setSigningOut(false)
      setSignOutOpen(false)
    }
  }

  return (
    <div className="min-h-dvh">
      {/* ------------------------------ Desktop sidebar ------------------- */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-coal-800/80 bg-coal-950/80 backdrop-blur-xl lg:flex">
        <div className="px-5 py-6">
          <Link to="/" className="inline-block rounded-lg">
            <Logo />
          </Link>
        </div>

        <nav className="flex-1 space-y-1 px-3" aria-label="Main navigation">
          {items.map((item) => {
            const active = isNavActive(item, pathname)
            return (
              <NavLink
                key={item.to}
                to={item.to}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-150',
                  active
                    ? 'bg-pitch-600/15 text-pitch-300 ring-1 ring-inset ring-pitch-700/50'
                    : 'text-coal-400 hover:bg-coal-900 hover:text-coal-100'
                )}
              >
                <item.icon
                  className={cn(
                    'h-[18px] w-[18px] shrink-0 transition-colors',
                    active ? 'text-pitch-400' : 'text-coal-500 group-hover:text-coal-300'
                  )}
                />
                {item.label}
                {item.adminOnly && (
                  <ShieldCheck className="ml-auto h-3.5 w-3.5 text-coal-600" aria-label="Admin only" />
                )}
              </NavLink>
            )
          })}
        </nav>

        {isAdmin && (
          <div className="px-3 pb-3">
            <Button
              fullWidth
              icon={<Plus className="h-4 w-4" />}
              onClick={() => navigate('/create-match')}
            >
              New match
            </Button>
          </div>
        )}

        <div className="border-t border-coal-800/80 p-3">
          <Link
            to="/profile"
            className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-coal-900"
          >
            <Avatar
              id={profile?.id ?? 'anon'}
              name={profile?.full_name}
              url={profile?.avatar_url}
              size="sm"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-coal-100">
                {profile?.full_name ?? 'Player'}
              </p>
              <p className="truncate text-xs text-coal-500">
                {isAdmin ? 'Team admin' : 'Player'}
              </p>
            </div>
          </Link>
          <button
            type="button"
            onClick={() => setSignOutOpen(true)}
            className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-coal-500 transition-colors hover:bg-coal-900 hover:text-rose-300"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* ------------------------------ Mobile top bar -------------------- */}
      <header className="sticky top-0 z-30 border-b border-coal-800/80 bg-coal-950/90 backdrop-blur-xl lg:hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="flex items-center gap-2.5">
            <LogoMark className="h-8 w-8" />
            <span className="font-display text-sm font-bold uppercase tracking-[0.14em] text-white">
              KK Cricket
            </span>
          </Link>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Badge className="bg-pitch-600/20 text-pitch-300 ring-pitch-700/50" dot="bg-pitch-400">
                Admin
              </Badge>
            )}
            <Link
              to="/profile"
              aria-label="Your profile"
              className="rounded-full ring-offset-2 ring-offset-coal-950 focus-visible:ring-2"
            >
              {profile ? (
                <Avatar id={profile.id} name={profile.full_name} url={profile.avatar_url} size="sm" />
              ) : (
                <UserIcon className="h-5 w-5 text-coal-400" />
              )}
            </Link>
          </div>
        </div>
      </header>

      {/* ------------------------------ Content --------------------------- */}
      <main className="lg:pl-64">
        <div className="mx-auto w-full max-w-5xl px-4 pb-nav pt-5 sm:px-6 lg:pb-12 lg:pt-8">
          <Outlet />
        </div>
      </main>

      {/* ------------------------------ Mobile bottom nav ----------------- */}
      <nav
        aria-label="Main navigation"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-coal-800/80 bg-coal-950/95 backdrop-blur-xl lg:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-stretch">
          {items.map((item) => {
            const active = isNavActive(item, pathname)
            return (
              <NavLink
                key={item.to}
                to={item.to}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-semibold uppercase tracking-wide transition-colors',
                  active ? 'text-pitch-400' : 'text-coal-500'
                )}
              >
                {active && (
                  <span className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-pitch-gradient" />
                )}
                <item.icon className={cn('h-5 w-5', active && 'scale-110 transition-transform')} />
                {item.short}
              </NavLink>
            )
          })}
        </div>
      </nav>

      {/* Floating "new match" action for admins on mobile. */}
      {isAdmin && pathname !== '/create-match' && (
        <Link
          to="/create-match"
          aria-label="Create a new match"
          className="fixed bottom-[5.5rem] right-4 z-40 flex h-14 w-14 items-center justify-center rounded-2xl bg-pitch-600 text-white shadow-[0_10px_30px_-6px_rgba(22,179,100,0.8)] transition-transform active:scale-95 lg:hidden"
          style={{ bottom: 'calc(5.5rem + env(safe-area-inset-bottom))' }}
        >
          <Plus className="h-6 w-6" />
        </Link>
      )}

      <ConfirmDialog
        open={signOutOpen}
        title="Sign out?"
        message="You will need to sign in again to vote or view payments."
        confirmLabel="Sign out"
        destructive
        loading={signingOut}
        onConfirm={handleSignOut}
        onCancel={() => setSignOutOpen(false)}
      />
    </div>
  )
}
