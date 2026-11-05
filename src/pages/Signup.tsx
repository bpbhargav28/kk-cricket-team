import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, Phone, UserPlus } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { friendlyError } from '../lib/errors'
import { AuthLayout } from '../components/auth/AuthLayout'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Field'
import { Alert } from '../components/ui/Misc'

interface Errors {
  fullName?: string
  email?: string
  phone?: string
  password?: string
  confirm?: string
}

export default function Signup() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [confirmationSent, setConfirmationSent] = useState(false)

  function validate() {
    const next: Errors = {}

    if (fullName.trim().length < 2) next.fullName = 'Enter your full name (at least 2 characters).'
    else if (fullName.trim().length > 80) next.fullName = 'That name is too long.'

    if (!email.trim()) next.email = 'Enter your email address.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      next.email = 'That does not look like a valid email address.'

    const digits = phone.replace(/\D/g, '')
    if (phone.trim() && (digits.length < 10 || digits.length > 13))
      next.phone = 'Enter a valid phone number, or leave it blank.'

    if (password.length < 8) next.password = 'Use at least 8 characters.'
    else if (!/[a-zA-Z]/.test(password) || !/\d/.test(password))
      next.password = 'Include at least one letter and one number.'

    if (confirm !== password) next.confirm = 'The passwords do not match.'

    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!validate()) return

    setSubmitting(true)
    try {
      const { needsEmailConfirmation } = await signUp({
        email,
        password,
        fullName,
        phone: phone.trim() || undefined,
      })

      if (needsEmailConfirmation) {
        setConfirmationSent(true)
      } else {
        toast.success(`Welcome to KK Cricket Team, ${fullName.trim().split(' ')[0]}!`)
        navigate('/', { replace: true })
      }
    } catch (err) {
      setFormError(friendlyError(err, 'Could not create your account.'))
    } finally {
      setSubmitting(false)
    }
  }

  if (confirmationSent) {
    return (
      <AuthLayout
        title="Confirm your email"
        subtitle={`We sent a confirmation link to ${email.trim()}. Open it to activate your account, then sign in.`}
        footer={
          <Link to="/login" className="font-semibold text-pitch-400 hover:text-pitch-300">
            Back to sign in
          </Link>
        }
      >
        <Alert tone="success" title="Almost there">
          Can&apos;t find the email? Check your spam folder. If your team admin has disabled email
          confirmation in Supabase, you can sign in straight away.
        </Alert>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Join the squad to vote for matches and track your share of the expenses."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-pitch-400 hover:text-pitch-300">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {formError && <Alert tone="danger">{formError}</Alert>}

        <Input
          label="Full name"
          autoComplete="name"
          placeholder="Bhargav Prasad"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          error={errors.fullName}
          required
        />

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

        <Input
          label="Phone (optional)"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="98765 43210"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          error={errors.phone}
          prefix={<Phone className="h-4 w-4" />}
          hint="Helps the admin reach you about match payments."
        />

        <Input
          label="Password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          hint={!errors.password ? 'Use 8+ characters with a letter and a number.' : undefined}
          required
        />

        <Input
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          placeholder="Re-enter your password"
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
          icon={<UserPlus className="h-4 w-4" />}
        >
          Create account
        </Button>

        <p className="text-center text-xs leading-relaxed text-coal-600">
          New accounts join as players. A team admin can promote you later.
        </p>
      </form>
    </AuthLayout>
  )
}
