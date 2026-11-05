import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { KeyRound } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { friendlyError } from '../lib/errors'
import { AuthLayout } from '../components/auth/AuthLayout'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Field'
import { Alert } from '../components/ui/Misc'

/**
 * Supabase sends the recovery link back to this route. `detectSessionInUrl`
 * exchanges the code for a temporary session, which is what lets updateUser()
 * set a new password here.
 */
export default function ResetPassword() {
  const { session, loading, updatePassword } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({})
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const next: typeof errors = {}
    if (password.length < 8) next.password = 'Use at least 8 characters.'
    else if (!/[a-zA-Z]/.test(password) || !/\d/.test(password))
      next.password = 'Include at least one letter and one number.'
    if (confirm !== password) next.confirm = 'The passwords do not match.'
    setErrors(next)
    if (Object.keys(next).length > 0) return

    setSubmitting(true)
    try {
      await updatePassword(password)
      toast.success('Your password has been updated.')
      navigate('/', { replace: true })
    } catch (err) {
      toast.error(friendlyError(err, 'Could not update your password.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Choose a new password"
      subtitle="Pick something you will remember — you will stay signed in on this device."
      footer={
        <Link to="/login" className="font-semibold text-pitch-400 hover:text-pitch-300">
          Back to sign in
        </Link>
      }
    >
      {!loading && !session ? (
        <Alert tone="warning" title="This reset link is no longer valid">
          Password reset links expire quickly. Request a new one from the sign-in page.
        </Alert>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <Input
            label="New password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
            required
          />
          <Input
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            error={errors.confirm}
            required
          />
          <Button
            type="submit"
            fullWidth
            size="lg"
            loading={submitting}
            icon={<KeyRound className="h-4 w-4" />}
          >
            Update password
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}
