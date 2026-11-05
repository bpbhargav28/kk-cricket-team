import { CircleDollarSign, HandCoins, TrendingDown, UserCheck, UserX } from 'lucide-react'
import type { MatchPaymentSummary } from '../../lib/database.types'
import { formatCurrency, formatCurrencyShort, toNumber } from '../../lib/format'
import { ProgressBar, StatCard } from '../ui/Misc'

export function PaymentSummaryTiles({ summary }: { summary: MatchPaymentSummary | null }) {
  const totalExpense = toNumber(summary?.total_expense)
  const collected = toNumber(summary?.total_collected)
  const outstanding = toNumber(summary?.outstanding)
  const paid = summary?.paid_count ?? 0
  const pending = (summary?.pending_count ?? 0) + (summary?.partially_paid_count ?? 0)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard
          label="Total expense"
          value={formatCurrencyShort(totalExpense)}
          icon={<CircleDollarSign className="h-4 w-4" />}
        />
        <StatCard
          label="Collected"
          value={formatCurrencyShort(collected)}
          icon={<HandCoins className="h-4 w-4" />}
          tone="green"
          sublabel={
            totalExpense > 0
              ? `${Math.round((collected / totalExpense) * 100)}% of the total`
              : undefined
          }
        />
        <StatCard
          label="Outstanding"
          value={formatCurrencyShort(outstanding)}
          icon={<TrendingDown className="h-4 w-4" />}
          tone={outstanding > 0 ? 'rose' : 'green'}
        />
        <StatCard
          label="Players paid"
          value={String(paid)}
          icon={<UserCheck className="h-4 w-4" />}
          tone="green"
        />
        <StatCard
          label="Payment pending"
          value={String(pending)}
          icon={<UserX className="h-4 w-4" />}
          tone={pending > 0 ? 'amber' : 'green'}
        />
      </div>

      <div className="card p-4">
        <div className="mb-2 flex items-baseline justify-between gap-3 text-sm">
          <span className="font-semibold text-coal-200">Collection progress</span>
          <span className="tabular-nums text-coal-400">
            {formatCurrency(collected)} / {formatCurrency(toNumber(summary?.total_due))}
          </span>
        </div>
        <ProgressBar
          value={collected}
          max={Math.max(toNumber(summary?.total_due), 1)}
          tone={outstanding > 0 ? 'amber' : 'green'}
          label="Collection progress"
        />
      </div>
    </div>
  )
}
