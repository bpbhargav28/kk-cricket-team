import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'

interface PageHeaderProps {
  title: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
  /** Renders a back link above the title. */
  backTo?: string
  backLabel?: string
}

export function PageHeader({ title, subtitle, action, backTo, backLabel }: PageHeaderProps) {
  return (
    <div className="mb-5 animate-fade-in">
      {backTo && (
        <Link
          to={backTo}
          className="mb-3 inline-flex items-center gap-1 rounded-lg text-sm font-medium text-coal-400 transition-colors hover:text-pitch-400"
        >
          <ChevronLeft className="h-4 w-4" />
          {backLabel ?? 'Back'}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold uppercase tracking-wide text-white sm:text-3xl">
            {title}
          </h1>
          {subtitle && <p className="mt-1 text-sm text-coal-400">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  )
}
