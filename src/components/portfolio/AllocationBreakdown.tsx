import { formatCurrency, formatPercent } from '@/lib/utils/format'

export type AllocationItem = {
  label: string
  value: number
  pct: number
}

// Tinten van sage/steel i.p.v. losse hues — houdt de grafiek binnen het
// 2-kleurensysteem (CLAUDE.md) en voorkomt dat terracotta (elders altijd
// "verlies") hier als toevallige categorie-kleur oogt als "slecht presterend".
const BAR_COLORS = [
  'bg-[var(--color-sage)]',
  'bg-[var(--color-steel)]',
  'bg-[var(--color-sage)]/55',
  'bg-[var(--color-steel)]/55',
  'bg-[var(--color-sage)]/30',
]

type Props = {
  title: string
  items: AllocationItem[]
}

export function AllocationBreakdown({ title, items }: Props) {
  if (items.length === 0) return null

  return (
    <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
      <p className="text-sm font-semibold text-foreground">{title}</p>

      {/* Gestapelde balk */}
      <div className="flex h-2 rounded-full overflow-hidden gap-px">
        {items.map((item, i) => (
          <div
            key={item.label}
            className={`${BAR_COLORS[i % BAR_COLORS.length]} transition-all`}
            style={{ width: `${item.pct * 100}%` }}
            title={`${item.label}: ${(item.pct * 100).toFixed(1)}%`}
          />
        ))}
      </div>

      {/* Legende */}
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={item.label} className="flex items-center gap-3">
            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${BAR_COLORS[i % BAR_COLORS.length]}`} />
            <span className="text-sm text-foreground flex-1 truncate">{item.label}</span>
            <span className="text-sm text-muted-foreground tabular-nums">{formatCurrency(item.value)}</span>
            <span className="text-xs text-muted-foreground tabular-nums w-12 text-right">
              {formatPercent(item.pct)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
