import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import * as api from '../lib/api'
import type { MatchInput } from '../lib/api'
import { friendlyError } from '../lib/errors'
import { PageHeader } from '../components/layout/PageHeader'
import { MatchForm } from '../components/match/MatchForm'

export default function CreateMatch() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(input: MatchInput) {
    if (!profile) return
    setSubmitting(true)
    try {
      const match = await api.createMatch(input, profile.id)
      toast.success(
        'Match published. Everyone in the squad can vote now.',
        match.title
      )
      navigate(`/matches/${match.id}`, { replace: true })
    } catch (err) {
      toast.error(friendlyError(err, 'Could not publish the match.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Create match"
        subtitle="Publish a fixture and the squad can vote for attendance straight away."
        backTo="/matches"
        backLabel="Back to matches"
      />
      <MatchForm
        submitLabel="Publish match"
        submitting={submitting}
        onSubmit={handleSubmit}
        onCancel={() => navigate('/matches')}
      />
    </div>
  )
}
