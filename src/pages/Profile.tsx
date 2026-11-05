import { useState } from 'react'
import type { FormEvent } from 'react'
import {
  CheckCircle2,
  KeyRound,
  LogOut,
  Mail,
  Phone,
  Shield,
  ShieldCheck,
  User as UserIcon,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { friendlyError } from '../lib/errors'
import { formatDateTime } from '../lib/format'
import { PageHeader } from '../components/layout/PageHeader'
import { Card, CardHeader } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Field'
import { Alert, Avatar, Badge, PageLoader } from '../components/ui/Misc'
import { ConfirmDialog } from '../components/ui/Modal'

export default function Profile() {
  const { profile, user, isAdmin, updateProfile, updatePassword, signOut } = useAuth()
  const toast = useToast()

  const [fullName, setFullName] = useState(profile?.full_name ?? '')
  const [phone, setPhone] = useState(profile?.phone ?? '')
  const [jersey, setJersey] = useState(profile?.jersey_no != null ? String(profile.jersey_no) : '')
  const [detailErrors, setDetailErrors] = useState<{ fullName?: string; jersey?: string }>({})
  const [savingDetails, setSavingDetails] = useState(false)

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [passwordErrors, setPasswordErrors] = useState<{ password?: string; confirm?: string }>({})
  const [savingPassword, setSavingPassword] = useState(false)

  const [signOutOpen, setSignOutOpen] = useState(false)

  if (!profile) return <PageLoader label="Loading your profile…" />

  async function saveDetails(e: FormEvent) {
    e.preventDefault()
    const next: typeof detailErrors = {}
    if (fullName.trim().length < 2) next.fullName = 'Enter your name.'

    let jerseyNo: number | null = null
    if (jersey.trim()) {
      const parsed = Number.parseInt(jersey, 10)
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 999) {
        next.jersey = 'Use a number between 0 and 999.'
      } else {
        jerseyNo = parsed
      }
    }

    setDetailErrors(next)
    if (Object.keys(next).length > 0) return

    setSavingDetails(true)
    try {
      await updateProfile({
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        jersey_no: jerseyNo,
      })
      toast.success('Profile updated.')
    } catch (err) {
      toast.error(friendlyError(err, 'Could not save your profile.'))
    } finally {
      setSavingDetails(false)
    }
  }

  async function savePassword(e: FormEvent) {
    e.preventDefault()
    const next: typeof passwordErrors = {}
    if (password.length < 8) next.password = 'Use at least 8 characters.'
    if (password !== confirm) next.confirm = 'The two passwords do not match.'

    setPasswordErrors(next)
    if (Object.keys(next).length > 0) return

    setSavingPassword(true)
    try {
      await updatePassword(password)
      setPassword('')
      setConfirm('')
      toast.success('Password changed. Use it the next time you sign in.')
    } catch (err) {
      toast.error(friendlyError(err, 'Could not change your password.'))
    } finally {
      setSavingPassword(false)
    }
  }

  async function handleSignOut() {
    try {
      await signOut()
    } catch (err) {
      toast.error(friendlyError(err, 'Could not sign out.'))
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader title="My profile" subtitle="Your details, password and account." />

      {/* ------------------------------ Identity ------------------------- */}
      <Card>
        <div className="flex flex-wrap items-center gap-4">
          <Avatar name={profile.full_name} id={profile.id} url={profile.avatar_url} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate font-display text-xl font-bold tracking-wide text-white">
                {profile.full_name}
              </h2>
              {profile.jersey_no != null && (
                <Badge className="bg-coal-800 text-coal-300 ring-coal-700">
                  #{profile.jersey_no}
                </Badge>
              )}
              <Badge
                className={
                  isAdmin
                    ? 'bg-pitch-950 text-pitch-300 ring-pitch-800/60'
                    : 'bg-coal-800 text-coal-300 ring-coal-700'
                }
                dot={isAdmin ? 'bg-pitch-400' : undefined}
              >
                {isAdmin ? 'Admin' : 'Player'}
              </Badge>
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-coal-400">
              <span className="inline-flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" />
                {profile.email ?? user?.email ?? '—'}
              </span>
              {profile.phone && (
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" />
                  {profile.phone}
                </span>
              )}
            </p>
            <p className="mt-1 text-xs text-coal-600">
              Member since {formatDateTime(profile.created_at)}
            </p>
          </div>
        </div>

        {!profile.is_active && (
          <Alert tone="warning" className="mt-4">
            Your account is marked inactive, so you are not counted in new match splits. Ask an
            admin to reactivate it.
          </Alert>
        )}
      </Card>

      {/* ------------------------------ Details -------------------------- */}
      <Card>
        <CardHeader
          title="Your details"
          subtitle="Visible to the rest of the squad."
          icon={<UserIcon className="h-4 w-4" />}
        />
        <form onSubmit={saveDetails} className="space-y-4" noValidate>
          <Input
            label="Full name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            error={detailErrors.fullName}
            autoComplete="name"
            required
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Phone"
              type="tel"
              inputMode="tel"
              placeholder="+91 98765 43210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              prefix={<Phone className="h-4 w-4" />}
              autoComplete="tel"
              hint="Optional — helps admins reach you about payments."
            />
            <Input
              label="Jersey number"
              type="number"
              inputMode="numeric"
              min="0"
              max="999"
              placeholder="07"
              value={jersey}
              onChange={(e) => setJersey(e.target.value)}
              error={detailErrors.jersey}
              hint="Optional."
            />
          </div>
          <Input
            label="Email"
            value={profile.email ?? user?.email ?? ''}
            disabled
            readOnly
            prefix={<Mail className="h-4 w-4" />}
            hint="Your email is your sign-in ID and cannot be changed here."
          />
          <Button
            type="submit"
            loading={savingDetails}
            icon={<CheckCircle2 className="h-4 w-4" />}
          >
            Save details
          </Button>
        </form>
      </Card>

      {/* ------------------------------ Password ------------------------- */}
      <Card>
        <CardHeader
          title="Change password"
          subtitle="You stay signed in on this device after changing it."
          icon={<KeyRound className="h-4 w-4" />}
        />
        <form onSubmit={savePassword} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="New password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={passwordErrors.password}
              autoComplete="new-password"
              hint="At least 8 characters."
            />
            <Input
              label="Confirm new password"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              error={passwordErrors.confirm}
              autoComplete="new-password"
            />
          </div>
          <Button type="submit" variant="secondary" loading={savingPassword}>
            Update password
          </Button>
        </form>
      </Card>

      {/* ------------------------------- Role ---------------------------- */}
      <Card>
        <CardHeader
          title="Permissions"
          subtitle="What your account can do."
          icon={isAdmin ? <ShieldCheck className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
        />
        <ul className="space-y-2 text-sm text-coal-300">
          {(isAdmin
            ? [
                'Create, edit, cancel and delete matches',
                'Set the total match expense and expense line items',
                'Close and reopen voting',
                'Adjust individual contributions and exempt players',
                'Record payments for any player',
                'Manage the squad and promote other admins',
              ]
            : [
                'Vote for attendance on upcoming matches, and change your vote until voting closes',
                'See the confirmed squad and your own contribution for each match',
                'View your own payment history and the overall match totals',
              ]
          ).map((line) => (
            <li key={line} className="flex gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-pitch-400" />
              {line}
            </li>
          ))}
        </ul>
        {!isAdmin && (
          <p className="mt-4 text-xs text-coal-500">
            Admin rights are granted by an existing admin, and every privileged action is checked
            again in the database — not just in this app.
          </p>
        )}
      </Card>

      {/* ------------------------------ Sign out ------------------------- */}
      <Card>
        <Button
          variant="secondary"
          icon={<LogOut className="h-4 w-4" />}
          onClick={() => setSignOutOpen(true)}
        >
          Sign out
        </Button>
      </Card>

      <ConfirmDialog
        open={signOutOpen}
        title="Sign out of KK Cricket Team?"
        message="You will need your email and password to sign back in."
        confirmLabel="Sign out"
        onConfirm={() => void handleSignOut()}
        onCancel={() => setSignOutOpen(false)}
      />
    </div>
  )
}
