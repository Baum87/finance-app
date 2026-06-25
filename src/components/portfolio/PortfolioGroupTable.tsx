import Link from 'next/link'
import Decimal from 'decimal.js'
import { formatCurrency, formatPercent } from '@/lib/utils/format'

export type GroupedAssetRow = {
  id: string
  name: string
  ticker: string | null
  groupKey: string
  currentValue: Decimal
  netDeposit: Decimal
  detailHref: string
}

export function PortfolioGroupTable({ rows, emptyGroupLabel }: {
  rows: GroupedAssetRow[]
  emptyGroupLabel: string
}) {
  const groupMap = new Map<string, GroupedAssetRow[]>()
  for (const r of rows) {
    const key = r.groupKey || emptyGroupLabel
    if (!groupMap.has(key)) groupMap.set(key, [])
    groupMap.get(key)!.push(r)
  }

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="hidden md:grid grid-cols-[1fr_auto_auto_auto_auto] gap-6 px-6 py-2.5 border-b border-border bg-muted/30">
        <span className="text-xs text-muted-foreground">Asset</span>
        <span className="text-xs text-muted-foreground text-right w-28">Waarde</span>
        <span className="text-xs text-muted-foreground text-right w-28">Netto inleg</span>
        <span className="text-xs text-muted-foreground text-right w-28">W/V</span>
        <span className="text-xs text-muted-foreground text-right w-20">%</span>
      </div>
      {[...groupMap.entries()].map(([group, groupRows]) => (
        <div key={group}>
          <div className="px-6 py-2 bg-muted/20 border-t border-border">
            <span className="text-xs font-medium text-muted-foreground">{group}</span>
          </div>
          <div className="divide-y divide-border">
            {groupRows.map(r => {
              const wv = r.currentValue.minus(r.netDeposit)
              const pct = r.netDeposit.gt(0) ? wv.div(r.netDeposit) : null
              return (
                <Link
                  key={r.id}
                  href={r.detailHref}
                  className="grid grid-cols-[1fr_auto] md:grid-cols-[1fr_auto_auto_auto_auto] gap-6 items-center px-6 py-4 hover:bg-muted/50 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">{r.name}</p>
                    {r.ticker && <p className="text-xs text-muted-foreground mt-0.5">{r.ticker}</p>}
                  </div>
                  <span className="text-sm font-semibold text-foreground text-right w-28">
                    {formatCurrency(r.currentValue.toNumber())}
                  </span>
                  <span className="text-sm text-muted-foreground text-right w-28 hidden md:block">
                    {r.netDeposit.gt(0) ? formatCurrency(r.netDeposit.toNumber()) : '—'}
                  </span>
                  <span className={`text-sm font-medium text-right w-28 hidden md:block ${r.netDeposit.gt(0) ? (wv.gte(0) ? 'text-sage' : 'text-terracotta') : 'text-muted-foreground'}`}>
                    {r.netDeposit.gt(0) ? formatCurrency(wv.toNumber()) : '—'}
                  </span>
                  <span className={`text-sm font-medium text-right w-20 hidden md:block ${pct ? (pct.gte(0) ? 'text-sage' : 'text-terracotta') : 'text-muted-foreground'}`}>
                    {pct ? formatPercent(pct.toNumber()) : '—'}
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
