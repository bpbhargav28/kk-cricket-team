import type { ReactNode } from 'react'
import { APP_TAGLINE } from '../../lib/constants'
import { LogoMark } from '../layout/Logo'

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      {/* Decorative pitch arc behind the card. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[720px] max-w-full -translate-x-1/2 rounded-b-[50%] bg-pitch-600/10 blur-3xl"
      />

      <div className="relative w-full max-w-md animate-slide-up">
        <div className="mb-7 flex flex-col items-center text-center">
          <LogoMark className="h-14 w-14 rounded-2xl" />
          <h1 className="mt-4 font-display text-3xl font-bold uppercase tracking-[0.16em] text-white">
            KK Cricket
          </h1>
          <p className="mt-1 font-display text-xs font-semibold uppercase tracking-[0.42em] text-pitch-500">
            Team
          </p>
          <p className="mt-3 text-sm text-coal-500">{APP_TAGLINE}</p>
        </div>

        <div className="card p-6 sm:p-7">
          <h2 className="font-display text-xl font-semibold tracking-wide text-white">{title}</h2>
          {subtitle && <p className="mt-1.5 text-sm leading-relaxed text-coal-400">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>

        {footer && <div className="mt-5 text-center text-sm text-coal-500">{footer}</div>}
      </div>
    </div>
  )
}
