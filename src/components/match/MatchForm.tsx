import { useMemo, useState } from 'react'
import { CalendarDays, Clock, IndianRupee, MapPin, Save, Trophy } from 'lucide-react'
import type { Match } from '../../lib/database.types'
import type { MatchInput } from '../../lib/api'
import {
  formatCurrency,
  toDateInput,
  toDateTimeInput,
  fromDateTimeInput,
  round2,
} from '../../lib/format'
import { Button } from '../ui/Button'
import { Input, Textarea } from '../ui/Field'
import { Alert } from '../ui/Misc'
import { Card, CardHeader } from '../ui/Card'

interface MatchFormProps {
  initial?: Match
  /** Confirmed attendance, used to preview the per-player share while typing. */
  confirmedCount?: number
  submitLabel?: string
  submitting?: boolean
  onSubmit: (input: MatchInput) => Promise<void>
  onCancel?: () => void
}

type Errors = Partial<Record<keyof MatchInput, string>>

export function MatchForm({
  initial,
  confirmedCount = 0,
  submitLabel = 'Publish match',
  submitting = false,
  onSubmit,
  onCancel,
}: MatchFormProps) {
  const [title, setTitle] = useState(initial?.title ?? 'Sunday Cricket Match')
  const [matchDate, setMatchDate] = useState(initial?.match_date ?? toDateInput(nextSunday()))
  const [matchTime, setMatchTime] = useState((initial?.match_time ?? '07:30:00').slice(0, 5))
  const [location, setLocation] = useState(initial?.location ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [totalExpense, setTotalExpense] = useState(
    initial ? String(initial.total_expense) : ''
  )
  const [votingDeadline, setVotingDeadline] = useState(
    toDateTimeInput(initial?.voting_deadline) || ''
  )
  const [errors, setErrors] = useState<Errors>({})

  const expenseNumber = Number.parseFloat(totalExpense)
  const perPlayerPreview = useMemo(() => {
    if (!Number.isFinite(expenseNumber) || confirmedCount <= 0) return null
    return round2(expenseNumber / confirmedCount)
  }, [expenseNumber, confirmedCount])

  function validate(): MatchInput | null {
    const next: Errors = {}

    const trimmedTitle = title.trim()
    if (trimmedTitle.length < 3) next.title = 'Give the match a title of at least 3 characters.'
    else if (trimmedTitle.length > 120) next.title = 'Keep the title under 120 characters.'

    if (!matchDate) next.match_date = 'Pick the match date.'

    if (!matchTime) next.match_time = 'Pick the start time.'

    const trimmedLocation = location.trim()
    if (trimmedLocation.length < 3) next.location = 'Enter the ground or location.'
    else if (trimmedLocation.length > 160) next.location = 'That location name is too long.'

    if (totalExpense.trim() === '') next.total_expense = 'Enter the estimated total expense.'
    else if (!Number.isFinite(expenseNumber) || expenseNumber < 0)
      next.total_expense = 'Enter a valid amount of ₹0 or more.'
    else if (expenseNumber > 10_000_000) next.total_expense = 'That amount looks too large.'

    if (description.length > 2000) next.description = 'Keep the description under 2000 characters.'

    if (votingDeadline) {
      const deadline = new Date(votingDeadline)
      const kickOff = new Date(`${matchDate}T${matchTime}`)
      if (Number.isNaN(deadline.getTime())) {
        next.voting_deadline = 'That deadline is not a valid date and time.'
      } else if (matchDate && matchTime && deadline > kickOff) {
        next.voting_deadline = 'Voting must close before the match starts.'
      }
    }

    setErrors(next)
    if (Object.keys(next).length > 0) return null

    return {
      title: trimmedTitle,
      match_date: matchDate,
      match_time: `${matchTime}:00`,
      location: trimmedLocation,
      description: description.trim() || null,
      total_expense: round2(expenseNumber),
      voting_deadline: fromDateTimeInput(votingDeadline),
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const input = validate()
    if (input) await onSubmit(input)
  }

  const expenseChanged =
    initial !== undefined && round2(expenseNumber || 0) !== round2(Number(initial.total_expense))

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <Card>
        <CardHeader title="Match details" icon={<Trophy className="h-4 w-4" />} />

        <div className="space-y-4">
          <Input
            label="Match title"
            placeholder="Sunday Cricket Match"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            error={errors.title}
            maxLength={120}
            required
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Match date"
              type="date"
              value={matchDate}
              onChange={(e) => setMatchDate(e.target.value)}
              error={errors.match_date}
              prefix={<CalendarDays className="h-4 w-4" />}
              className="pl-9"
              required
            />
            <Input
              label="Start time"
              type="time"
              value={matchTime}
              onChange={(e) => setMatchTime(e.target.value)}
              error={errors.match_time}
              prefix={<Clock className="h-4 w-4" />}
              className="pl-9"
              required
            />
          </div>

          <Input
            label="Cricket ground / location"
            placeholder="Bangalore Cricket Ground"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            error={errors.location}
            prefix={<MapPin className="h-4 w-4" />}
            maxLength={160}
            required
          />

          <Textarea
            label="Description"
            placeholder="Nets from 7:00 AM. Bring white kit. Parking behind the pavilion."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            error={errors.description}
            rows={3}
            maxLength={2000}
            hint="Optional — anything the squad should know before turning up."
          />
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Expenses & voting"
          subtitle="The total is split equally between players who vote “Yes”."
          icon={<IndianRupee className="h-4 w-4" />}
        />

        <div className="space-y-4">
          <Input
            label="Total estimated expense"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            placeholder="3000"
            value={totalExpense}
            onChange={(e) => setTotalExpense(e.target.value)}
            error={errors.total_expense}
            prefix={<IndianRupee className="h-4 w-4" />}
            hint={
              perPlayerPreview !== null
                ? `With ${confirmedCount} confirmed, that is ${formatCurrency(perPlayerPreview)} each.`
                : 'Ground booking, balls, refreshments — the lot.'
            }
            required
          />

          <Input
            label="Voting deadline"
            type="datetime-local"
            value={votingDeadline}
            onChange={(e) => setVotingDeadline(e.target.value)}
            error={errors.voting_deadline}
            hint="Optional. After this, players can no longer change their vote."
          />
        </div>

        {expenseChanged && initial?.contributions_finalized && (
          <Alert tone="warning" className="mt-4" title="Contributions are already finalized">
            Saving a new total will not change anybody&apos;s amount on its own. You will be asked to
            confirm a re-split, and the change is written to the audit history.
          </Alert>
        )}
      </Card>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancel && (
          <Button variant="ghost" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          size="lg"
          loading={submitting}
          icon={<Save className="h-4 w-4" />}
          className="sm:min-w-44"
        >
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}

/** Sensible default: the next upcoming Sunday. */
function nextSunday(): Date {
  const d = new Date()
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7 || 7))
  return d
}
