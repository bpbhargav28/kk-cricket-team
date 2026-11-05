import type { ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '../../lib/cn'
import { avatarTint, initials } from '../../lib/format'

/* ------------------------------- Badge ----------------------------------- */

export function Badge({
  children,
  className,
  dot,
}: {
  children: ReactNode
  className?: string
  dot?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset',
        className ?? 'bg-coal-800 text-coal-300 ring-coal-700'
      )}
    >
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full', dot)} />}
      {children}
    </span>
  )
}

/* ------------------------------- Avatar ---------------------------------- */

export function Avatar({
  name,
  id,
  url,
  size = 'md',
  className,
}: {
  name: string | null | undefined
  id: string
  url?: string | null
  size?: 'xs' | 'sm' | 'md' | 'lg'
  className?: string
}) {
  const sizes = {
    xs: 'h-6 w-6 text-[10px]',
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-14 w-14 text-base',
  }

  if (url) {
    return (
      <img
        src={url}
        alt={name ?? 'Player'}
        className={cn('shrink-0 rounded-full object-cover ring-1 ring-coal-700', sizes[size], className)}
      />
    )
  }

  return (
    <span
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-bold uppercase ring-1 ring-inset',
        avatarTint(id),
        sizes[size],
        className
      )}
    >
      {initials(name)}
    </span>
  )
}

/* ------------------------------ Spinner ---------------------------------- */

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-5 w-5 animate-spin text-pitch-500', className)} aria-hidden />
}

export function PageLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3" role="status">
      <Spinner className="h-7 w-7" />
      <p className="text-sm text-coal-400">{label}</p>
    </div>
  )
}

/* ----------------------------- Skeletons --------------------------------- */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} aria-hidden />
}

export function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="card space-y-3 p-5" aria-hidden>
      <Skeleton className="h-5 w-2/5" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className={cn('h-4', i === rows - 1 ? 'w-3/5' : 'w-full')} />
      ))}
    </div>
  )
}

/* ---------------------------- Empty state -------------------------------- */

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode
  title: string
  description?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-coal-800 px-6 py-12 text-center">
      {icon && (
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-coal-900 text-coal-500 ring-1 ring-coal-800">
          {icon}
        </span>
      )}
      <div>
        <p className="font-display text-base font-semibold uppercase tracking-wide text-coal-200">
          {title}
        </p>
        {description && (
          <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-coal-500">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  )
}

/* ------------------------------ StatCard --------------------------------- */

export function StatCard({
  label,
  value,
  sublabel,
  icon,
  tone = 'default',
  className,
}: {
  label: string
  value: ReactNode
  sublabel?: ReactNode
  icon?: ReactNode
  tone?: 'default' | 'green' | 'amber' | 'rose'
  className?: string
}) {
  const tones = {
    default: 'text-coal-300 bg-coal-800/70 ring-coal-700/60',
    green: 'text-pitch-300 bg-pitch-950/70 ring-pitch-800/50',
    amber: 'text-amber-300 bg-amber-950/50 ring-amber-900/50',
    rose: 'text-rose-300 bg-rose-950/50 ring-rose-900/50',
  }

  return (
    <div className={cn('card card-hover p-4', className)}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-coal-400">{label}</p>
        {icon && (
          <span
            className={cn(
              'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset',
              tones[tone]
            )}
          >
            {icon}
          </span>
        )}
      </div>
      <p className="stat-value mt-2.5">{value}</p>
      {sublabel && <p className="mt-1 text-xs text-coal-500">{sublabel}</p>}
    </div>
  )
}

/* ---------------------------- ProgressBar -------------------------------- */

export function ProgressBar({
  value,
  max,
  className,
  tone = 'green',
  label,
}: {
  value: number
  max: number
  className?: string
  tone?: 'green' | 'amber'
  label?: string
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0
  const tones = { green: 'bg-pitch-gradient', amber: 'bg-gradient-to-r from-amber-600 to-amber-400' }

  return (
    <div
      className={cn('h-2 w-full overflow-hidden rounded-full bg-coal-800', className)}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className={cn('h-full rounded-full transition-[width] duration-500 ease-out', tones[tone])}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

/* -------------------------------- Alert ---------------------------------- */

export function Alert({
  tone = 'info',
  title,
  children,
  icon,
  className,
}: {
  tone?: 'info' | 'warning' | 'danger' | 'success'
  title?: ReactNode
  children?: ReactNode
  icon?: ReactNode
  className?: string
}) {
  const tones = {
    info: 'border-sky-900/60 bg-sky-950/40 text-sky-200',
    warning: 'border-amber-900/60 bg-amber-950/40 text-amber-200',
    danger: 'border-rose-900/60 bg-rose-950/40 text-rose-200',
    success: 'border-pitch-800/60 bg-pitch-950/50 text-pitch-200',
  }

  return (
    <div
      className={cn('flex gap-3 rounded-xl border px-4 py-3 text-sm', tones[tone], className)}
      role={tone === 'danger' ? 'alert' : undefined}
    >
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn('leading-relaxed', title && 'mt-1 opacity-90')}>{children}</div>}
      </div>
    </div>
  )
}
