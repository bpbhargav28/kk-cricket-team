import { useCallback, useMemo, useState } from 'react'
import {
  CheckCircle2,
  Phone,
  Search,
  Shield,
  ShieldCheck,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useAsyncData } from '../hooks/useAsyncData'
import { useRealtime } from '../hooks/useRealtime'
import * as api from '../lib/api'
import type { Profile } from '../lib/database.types'
import { cn } from '../lib/cn'
import { friendlyError } from '../lib/errors'
import { formatRelative } from '../lib/format'
import { PageHeader } from '../components/layout/PageHeader'
import { Card, CardHeader } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Field'
import { Alert, Avatar, Badge, CardSkeleton, EmptyState, StatCard } from '../components/ui/Misc'
import { ConfirmDialog, Modal } from '../components/ui/Modal'

/**
 * Squad list. Everyone can see who is in the team; only an admin sees the
 * management controls — and the `profiles` RLS policies reject the writes
 * regardless of what the client renders.
 */
export default function Players() {
  const { profile: me, isAdmin } = useAuth()
  const toast = useToast()
  const players = useAsyncData(() => api.fetchPlayers(), [])

  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Profile | null>(null)
  const [promoting, setPromoting] = useState<Profile | null>(null)
  const [demoting, setDemoting] = useState<Profile | null>(null)
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(() => {
    void players.refresh()
  }, [players])

  useRealtime('players', [{ table: 'profiles' }], refresh)

  const list = players.data ?? []

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return list
    return list.filter(
      (p) =>
        p.full_name.toLowerCase().includes(q) ||
        (p.email ?? '').toLowerCase().includes(q) ||
        (p.phone ?? '').includes(q) ||
        String(p.jersey_no ?? '').includes(q)
    )
  }, [list, query])

  const stats = useMemo(
    () => ({
      total: list.length,
      active: list.filter((p) => p.is_active).length,
      admins: list.filter((p) => p.role === 'admin' && p.is_active).length,
      inactive: list.filter((p) => !p.is_active).length,
    }),
    [list]
  )

  async function changeRole(player: Profile, role: 'admin' | 'player') {
    setBusy(true)
    try {
      if (role === 'admin') {
        await api.promoteToAdmin(player.email ?? '')
        toast.success(`${player.full_name} can now manage matches and payments.`, 'Admin added')
      } else {
        await api.updatePlayer(player.id, { role: 'player' })
        toast.success(`${player.full_name} is now a regular player.`)
      }
      refresh()
    } catch (err) {
      toast.error(friendlyError(err, 'Could not change the role.'))
    } finally {
      setBusy(false)
      setPromoting(null)
      setDemoting(null)
    }
  }

  async function toggleActive(player: Profile) {
    try {
      await api.updatePlayer(player.id, { is_active: !player.is_active })
      toast.success(
        player.is_active
          ? `${player.full_name} moved to inactive. They stay in past records but are not counted in new splits.`
          : `${player.full_name} is back in the squad.`
      )
      refresh()
    } catch (err) {
      toast.error(friendlyError(err, 'Could not update the player.'))
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Squad"
        subtitle={
          isAdmin
            ? 'Manage the squad, jersey numbers and who has admin rights.'
            : 'Everyone in the KK Cricket Team.'
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Registered players"
          value={String(stats.total)}
          icon={<Users className="h-4 w-4" />}
          tone="green"
        />
        <StatCard label="Active" value={String(stats.active)} icon={<UserCheck className="h-4 w-4" />} />
        <StatCard label="Admins" value={String(stats.admins)} icon={<ShieldCheck className="h-4 w-4" />} />
        <StatCard
          label="Inactive"
          value={String(stats.inactive)}
          icon={<UserMinus className="h-4 w-4" />}
          tone={stats.inactive > 0 ? 'amber' : 'default'}
        />
      </div>

      {isAdmin && (
        <Alert tone="info" icon={<UserPlus className="h-4 w-4" />} title="Adding a teammate">
          Players join by signing up themselves at the login screen — share the app URL with them.
          Everyone starts as a player; promote someone here when you want a second admin.
        </Alert>
      )}

      {players.error && <Alert tone="danger">{players.error}</Alert>}

      <Card>
        <CardHeader
          title="Players"
          subtitle={`${filtered.length} of ${stats.total} shown`}
          icon={<Users className="h-4 w-4" />}
          action={
            <Input
              placeholder="Search name, phone, jersey…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              prefix={<Search className="h-4 w-4" />}
              wrapperClassName="sm:w-64"
              aria-label="Search players"
            />
          }
        />

        {players.loading && !players.data ? (
          <CardSkeleton rows={4} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Users className="h-5 w-5" />}
            title={query ? 'No players match that search' : 'No players yet'}
            description={
              query
                ? 'Try a different name or jersey number.'
                : 'Share the app URL with your friends so they can sign up.'
            }
          />
        ) : (
          <ul className="divide-y divide-coal-800 overflow-hidden rounded-xl border border-coal-800">
            {filtered.map((player) => (
              <li
                key={player.id}
                className={cn(
                  'flex flex-wrap items-center gap-x-3 gap-y-2 bg-coal-925/60 px-4 py-3',
                  !player.is_active && 'opacity-60'
                )}
              >
                <Avatar name={player.full_name} id={player.id} url={player.avatar_url} size="sm" />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-coal-100">
                      {player.full_name}
                      {player.id === me?.id && (
                        <span className="ml-1.5 text-xs font-normal text-coal-500">(you)</span>
                      )}
                    </p>
                    {player.jersey_no != null && (
                      <Badge className="bg-coal-800 text-coal-300 ring-coal-700">
                        #{player.jersey_no}
                      </Badge>
                    )}
                    {player.role === 'admin' && (
                      <Badge
                        className="bg-pitch-950 text-pitch-300 ring-pitch-800/60"
                        dot="bg-pitch-400"
                      >
                        Admin
                      </Badge>
                    )}
                    {!player.is_active && (
                      <Badge className="bg-coal-800 text-coal-400 ring-coal-700">Inactive</Badge>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-coal-500">
                    {player.email ?? 'No email on file'}
                    {player.phone && (
                      <span className="inline-flex items-center gap-1">
                        {' · '}
                        <Phone className="h-3 w-3" />
                        {player.phone}
                      </span>
                    )}
                    {' · joined '}
                    {formatRelative(player.created_at)}
                  </p>
                </div>

                {isAdmin && (
                  <div className="flex shrink-0 flex-wrap gap-1.5">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(player)}>
                      Edit
                    </Button>
                    {player.role === 'player' ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={<Shield className="h-3.5 w-3.5" />}
                        onClick={() => setPromoting(player)}
                        disabled={!player.email || !player.is_active}
                      >
                        Make admin
                      </Button>
                    ) : (
                      player.id !== me?.id && (
                        <Button size="sm" variant="ghost" onClick={() => setDemoting(player)}>
                          Remove admin
                        </Button>
                      )
                    )}
                    {player.id !== me?.id && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void toggleActive(player)}
                      >
                        {player.is_active ? 'Deactivate' : 'Reactivate'}
                      </Button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {editing && (
        <EditPlayerModal
          player={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            refresh()
          }}
        />
      )}

      <ConfirmDialog
        open={promoting !== null}
        title={`Give ${promoting?.full_name ?? ''} admin rights?`}
        message={
          <div className="space-y-2">
            <p>
              Admins can create and edit matches, change expenses, close voting, adjust individual
              contributions and record payments for everyone.
            </p>
            <p className="text-coal-400">
              Only hand this to someone you trust with the team's money.
            </p>
          </div>
        }
        confirmLabel="Make admin"
        loading={busy}
        onConfirm={() => promoting && void changeRole(promoting, 'admin')}
        onCancel={() => setPromoting(null)}
      />

      <ConfirmDialog
        open={demoting !== null}
        title={`Remove admin rights from ${demoting?.full_name ?? ''}?`}
        message="They keep their player account, votes and payment history, but lose access to all management actions."
        confirmLabel="Remove admin"
        destructive
        loading={busy}
        onConfirm={() => demoting && void changeRole(demoting, 'player')}
        onCancel={() => setDemoting(null)}
      />
    </div>
  )
}

/* -------------------------------------------------------------------------- */

function EditPlayerModal({
  player,
  onClose,
  onSaved,
}: {
  player: Profile
  onClose: () => void
  onSaved: () => void
}) {
  const toast = useToast()
  const [fullName, setFullName] = useState(player.full_name)
  const [phone, setPhone] = useState(player.phone ?? '')
  const [jersey, setJersey] = useState(player.jersey_no != null ? String(player.jersey_no) : '')
  const [errors, setErrors] = useState<{ fullName?: string; jersey?: string }>({})
  const [saving, setSaving] = useState(false)

  async function save() {
    const next: typeof errors = {}
    if (fullName.trim().length < 2) next.fullName = 'Enter the player’s name.'

    let jerseyNo: number | null = null
    if (jersey.trim()) {
      const parsed = Number.parseInt(jersey, 10)
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 999) {
        next.jersey = 'Use a number between 0 and 999.'
      } else {
        jerseyNo = parsed
      }
    }

    setErrors(next)
    if (Object.keys(next).length > 0) return

    setSaving(true)
    try {
      await api.updatePlayer(player.id, {
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        jersey_no: jerseyNo,
      })
      toast.success('Player updated.')
      onSaved()
    } catch (err) {
      toast.error(friendlyError(err, 'Could not update the player.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Edit ${player.full_name}`}
      description="Name, phone and jersey number. Email and password stay with the player's own account."
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            loading={saving}
            icon={<CheckCircle2 className="h-4 w-4" />}
            onClick={() => void save()}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="Full name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          error={errors.fullName}
          required
        />
        <Input
          label="Phone"
          type="tel"
          inputMode="tel"
          placeholder="+91 98765 43210"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          prefix={<Phone className="h-4 w-4" />}
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
          error={errors.jersey}
          hint="Optional — shown next to their name in vote lists."
        />
      </div>
    </Modal>
  )
}
