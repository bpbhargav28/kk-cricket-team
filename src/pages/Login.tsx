import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, LogIn, Mail } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { friendlyError } from '../lib/errors'
import { AuthLayout } from '../components/auth/AuthLayout'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Field'
import { Alert } from '../components/ui/Misc'
import { Modal } from '../components/ui/Modal'

export default function Login() {
  const { signIn, sendPasswordReset } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [resetOpen, setResetOpen] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetting, setResetting] = useState(false)

  const from = (location.state as { from?: string } | null)?.from ?? '/'

  function validate() {
    const next: typeof errors = {}
    if (!email.trim()) next.email = 'Enter your email address.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      next.email = 'That does not look like a valid email address.'
    if (!password) next.password = 'Enter your password.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!validate()) return

    setSubmitting(true)
    try {
      await signIn(email, password)
      toast.success('Welcome back to KK Cricket Team.')
      navigate(from, { replace: true })
    } catch (err) {
      setFormError(friendlyError(err, 'Could not sign you in.'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    if (!resetEmail.trim()) return
    setResetting(true)
    try {
      await sendPasswordReset(resetEmail)
      toast.success('Check your inbox for a password reset link.')
      setResetOpen(false)
      setResetEmail('')
    } catch (err) {
      toast.error(friendlyError(err, 'Could not send the reset email.'))
    } finally {
      setResetting(false)
    }
  }

  return (
    <AuthLayout
      title="Sign in"
      subtitle="Welcome back. Sign in to vote for the next match and check your contributions."
      footer={
        <>
          New to the team?{' '}
          <Link to="/signup" className="font-semibold text-pitch-400 hover:text-pitch-300">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {formError && <Alert tone="danger">{formError}</Alert>}

        <Input
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
          prefix={<Mail className="h-4 w-4" />}
          required
        />

        <div>
          <div className="relative">
            <Input
              label="Password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errors.password}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-3 top-[34px] rounded-md p-1 text-coal-500 transition-colors hover:text-coal-200"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              setResetEmail(email)
              setResetOpen(true)
            }}
            className="mt-2 text-xs font-semibold text-coal-400 transition-colors hover:text-pitch-400"
          >
            Forgot your password?
          </button>
        </div>

        <Button
          type="submit"
          fullWidth
          size="lg"
          loading={submitting}
          icon={<LogIn className="h-4 w-4" />}
        >
          Sign in
        </Button>
      </form>

      <Modal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Reset your password"
        description="We will email you a link to choose a new password."
        size="sm"
      >
        <form onSubmit={handleReset} className="space-y-4">
          <Input
            label="Email"
            type="email"
            inputMode="email"
            placeholder="you@example.com"
            value={resetEmail}
            onChange={(e) => setResetEmail(e.target.value)}
            prefix={<Mail className="h-4 w-4" />}
            required
          />
          <Button type="submit" fullWidth loading={resetting}>
            Send reset link
          </Button>
        </form>
      </Modal>
    </AuthLayout>
  )
}
