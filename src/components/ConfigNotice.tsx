import type { ReactNode } from 'react'
import { AlertTriangle, ExternalLink, FileCode2, KeyRound, ShieldAlert } from 'lucide-react'
import { LogoMark } from './layout/Logo'
import { Card } from './ui/Card'
import { Alert } from './ui/Misc'

/**
 * Rendered instead of the app when VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
 * are missing, so a fresh clone (or a Pages deploy with empty repository
 * secrets) explains itself rather than throwing in the console.
 */
export function ConfigNotice() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-coal-gradient px-4 py-12">
      <Card className="w-full max-w-xl">
        <div className="flex items-center gap-3">
          <LogoMark className="h-11 w-11" />
          <div>
            <h1 className="font-display text-xl font-bold uppercase tracking-wide text-white">
              Almost there
            </h1>
            <p className="text-sm text-coal-400">KK Cricket Team needs its Supabase keys.</p>
          </div>
        </div>

        <Alert
          tone="warning"
          className="mt-5"
          icon={<AlertTriangle className="h-4 w-4" />}
          title="Supabase is not configured"
        >
          The app could not find <code className="rounded bg-black/40 px-1">VITE_SUPABASE_URL</code>{' '}
          and <code className="rounded bg-black/40 px-1">VITE_SUPABASE_ANON_KEY</code>.
        </Alert>

        <ol className="mt-5 space-y-4 text-sm text-coal-300">
          <Step
            n={1}
            icon={<ExternalLink className="h-4 w-4" />}
            title="Create a Supabase project"
          >
            Go to{' '}
            <a
              className="font-semibold text-pitch-400 hover:text-pitch-300"
              href="https://supabase.com/dashboard"
              target="_blank"
              rel="noreferrer noopener"
            >
              supabase.com/dashboard
            </a>{' '}
            and create a free project.
          </Step>

          <Step n={2} icon={<FileCode2 className="h-4 w-4" />} title="Run the migrations">
            In the SQL editor, run each file in{' '}
            <code className="rounded bg-black/40 px-1">supabase/migrations</code> in filename order.
          </Step>

          <Step n={3} icon={<KeyRound className="h-4 w-4" />} title="Add the keys locally">
            Copy <code className="rounded bg-black/40 px-1">.env.example</code> to{' '}
            <code className="rounded bg-black/40 px-1">.env</code>, paste the Project URL and the{' '}
            <strong>publishable (anon)</strong> key from Project Settings → API, then restart{' '}
            <code className="rounded bg-black/40 px-1">npm run dev</code>.
          </Step>

          <Step n={4} icon={<ShieldAlert className="h-4 w-4" />} title="For GitHub Pages">
            Add the same two values as repository secrets named{' '}
            <code className="rounded bg-black/40 px-1">VITE_SUPABASE_URL</code> and{' '}
            <code className="rounded bg-black/40 px-1">VITE_SUPABASE_ANON_KEY</code>, then re-run
            the deploy workflow.
          </Step>
        </ol>

        <p className="mt-5 rounded-xl border border-rose-900/50 bg-rose-950/30 px-4 py-3 text-xs leading-relaxed text-rose-200">
          <strong>Never</strong> put the <code>service_role</code> key in a{' '}
          <code>VITE_*</code> variable or in this repository. Anything prefixed{' '}
          <code>VITE_</code> is baked into the public JavaScript bundle. Only the publishable
          (anon) key belongs in the browser — it is safe because every table is protected by Row
          Level Security.
        </p>

        <p className="mt-4 text-xs text-coal-500">
          Full walkthrough, including creating the first admin account, is in{' '}
          <code className="rounded bg-black/40 px-1">README.md</code>.
        </p>
      </Card>
    </div>
  )
}

function Step({
  n,
  icon,
  title,
  children,
}: {
  n: number
  icon: ReactNode
  title: string
  children: ReactNode
}) {
  return (
    <li className="flex gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-coal-800 text-coal-300 ring-1 ring-coal-700">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="font-semibold text-coal-100">
          {n}. {title}
        </p>
        <p className="mt-0.5 leading-relaxed text-coal-400">{children}</p>
      </div>
    </li>
  )
}
