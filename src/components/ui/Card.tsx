import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/cn'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean
  padded?: boolean
}

export function Card({ interactive, padded = true, className, children, ...rest }: CardProps) {
  return (
    <div
      className={cn('card', padded && 'p-4 sm:p-5', interactive && 'card-hover', className)}
      {...rest}
    >
      {children}
    </div>
  )
}

interface CardHeaderProps {
  title: ReactNode
  subtitle?: ReactNode
  icon?: ReactNode
  action?: ReactNode
  className?: string
}

export function CardHeader({ title, subtitle, icon, action, className }: CardHeaderProps) {
  return (
    <div className={cn('mb-4 flex items-start justify-between gap-3', className)}>
      <div className="flex min-w-0 items-center gap-3">
        {icon && (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-pitch-950/70 text-pitch-400 ring-1 ring-pitch-800/60">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h2 className="section-title truncate">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-coal-400">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
