import { cn } from '../../lib/cn'

/** The KK monogram — a stumps-and-ball mark drawn inline so it needs no asset. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'relative flex items-center justify-center overflow-hidden rounded-xl bg-pitch-gradient shadow-[0_6px_20px_-8px_rgba(22,179,100,0.8)]',
        className ?? 'h-9 w-9'
      )}
      aria-hidden
    >
      <svg viewBox="0 0 32 32" className="h-full w-full">
        {/* three stumps */}
        <g fill="rgba(8,9,11,0.8)">
          <rect x="9" y="8" width="2.4" height="14" rx="1.2" />
          <rect x="14.8" y="8" width="2.4" height="14" rx="1.2" />
          <rect x="20.6" y="8" width="2.4" height="14" rx="1.2" />
        </g>
        {/* bails */}
        <g fill="rgba(8,9,11,0.55)">
          <rect x="9" y="6.2" width="7.8" height="1.6" rx="0.8" />
          <rect x="15.2" y="6.2" width="7.8" height="1.6" rx="0.8" />
        </g>
        {/* ball */}
        <circle cx="24.5" cy="23" r="4" fill="#0e1013" opacity="0.85" />
        <circle cx="24.5" cy="23" r="2.6" fill="#f05252" />
      </svg>
    </span>
  )
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark />
      {!compact && (
        <div className="leading-none">
          <p className="font-display text-[17px] font-bold uppercase tracking-[0.12em] text-white">
            KK Cricket
          </p>
          <p className="mt-0.5 font-display text-[10px] font-semibold uppercase tracking-[0.3em] text-pitch-500">
            Team
          </p>
        </div>
      )}
    </div>
  )
}
