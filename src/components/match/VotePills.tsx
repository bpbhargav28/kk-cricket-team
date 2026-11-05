import { cn } from '../../lib/cn'

/** Compact yes / no / maybe tally shown on cards and headers. */
export function VotePills({
  yes,
  no,
  maybe,
  size = 'md',
}: {
  yes: number
  no: number
  maybe: number
  size?: 'sm' | 'md'
}) {
  const pills = [
    { count: yes, label: 'Yes', className: 'bg-pitch-600/20 text-pitch-300 ring-pitch-700/50' },
    { count: no, label: 'No', className: 'bg-rose-600/20 text-rose-300 ring-rose-800/50' },
    { count: maybe, label: 'Maybe', className: 'bg-amber-500/15 text-amber-300 ring-amber-800/50' },
  ]

  return (
    <div className="flex items-center gap-1.5">
      {pills.map((p) => (
        <span
          key={p.label}
          className={cn(
            'inline-flex items-center gap-1 rounded-lg font-semibold ring-1 ring-inset',
            size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm',
            p.className
          )}
        >
          <span className="tabular-nums">{p.count}</span>
          <span className="opacity-70">{p.label}</span>
        </span>
      ))}
    </div>
  )
}
