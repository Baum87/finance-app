'use client'

import Link from 'next/link'
import { useSortable } from '@/lib/utils/use-sortable'
import { SortableHeader } from '@/components/ui/SortableHeader'
import { formatCurrency, formatPercent } from '@/lib/utils/format'

export type PositionRow = {
  id: string
  name: string
  ticker: string | null
  sector: string | null
  instrumentType: string | null
  currentValue: number
  inleg: number
  winstVerlies: number
  winstPct: number | null
  /** Volledig verkocht (quantityHeld = 0) — wordt apart getoond, niet tussen de actieve posities. */
  isClosed: boolean
  /** Gerealiseerd resultaat (AVCO) — de W/V-vervanger voor gesloten posities. */
  realizedGain: number
}

type SortKey = 'name' | 'currentValue' | 'winstVerlies' | 'winstPct'

type Props = {
  rows: PositionRow[]
  backTo: string
}

export function BrokerPositionsTable({ rows, backTo }: Props) {
  const openRows = rows.filter(r => !r.isClosed)
  const closedRows = rows.filter(r => r.isClosed)

  const { sort, toggle, sorted } = useSortable<SortKey>('currentValue')

  const data = sorted(openRows, (key, r) => {
    if (key === 'name') return r.name
    if (key === 'currentValue') return r.currentValue
    if (key === 'winstVerlies') return r.winstVerlies
    if (key === 'winstPct') return r.winstPct
    return null
  })

  const instrLabel = (type: string | null) =>
    type === 'etf' ? 'ETF' : type === 'fund' ? 'Fonds' : 'Aandeel'

  return (
    <div className="space-y-3">
      {openRows.length > 0 && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <p className="text-sm font-semibold text-foreground">Posities</p>
          </div>

          {/* Header */}
          <div className="hidden md:grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-6 py-2 border-b border-border bg-muted/30">
            <SortableHeader label="Naam" sortKey="name" sort={sort} onToggle={toggle} />
            <SortableHeader label="Waarde" sortKey="currentValue" sort={sort} onToggle={toggle} className="text-right w-28" />
            <SortableHeader label="W/V" sortKey="winstVerlies" sort={sort} onToggle={toggle} className="text-right w-28" />
            <SortableHeader label="%" sortKey="winstPct" sort={sort} onToggle={toggle} className="text-right w-20" />
            <span className="w-2" />
          </div>

          <div className="divide-y divide-border">
            {data.map(r => {
              const hasInleg = r.inleg > 0
              const isPos = r.winstVerlies >= 0

              return (
                <Link
                  key={r.id}
                  href={`/portfolio/aandelen-etf/${r.id}?from=${backTo}`}
                  className="grid grid-cols-[1fr_auto] md:grid-cols-[1fr_auto_auto_auto_auto] gap-4 items-center px-6 py-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {r.ticker && (
                      <span className="text-xs font-mono font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                        {r.ticker}
                      </span>
                    )}
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-foreground truncate block">{r.name}</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground">{instrLabel(r.instrumentType)}</span>
                        {r.sector && (
                          <span className="text-xs text-muted-foreground">· {r.sector}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <span className="text-sm font-medium text-foreground text-right w-28">
                    {r.currentValue > 0 ? formatCurrency(r.currentValue) : '—'}
                  </span>
                  <span className={`text-sm font-medium text-right w-28 hidden md:block ${hasInleg ? (isPos ? 'text-sage' : 'text-terracotta') : 'text-muted-foreground'}`}>
                    {hasInleg ? formatCurrency(r.winstVerlies) : '—'}
                  </span>
                  <span className={`text-sm font-medium text-right w-20 hidden md:block ${r.winstPct !== null ? (isPos ? 'text-sage' : 'text-terracotta') : 'text-muted-foreground'}`}>
                    {r.winstPct !== null ? formatPercent(r.winstPct) : '—'}
                  </span>
                  <span className="text-muted-foreground text-xs hidden md:block">›</span>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {closedRows.length > 0 && (
        <details className="rounded-2xl border border-border bg-card overflow-hidden group">
          <summary className="cursor-pointer select-none px-6 py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2">
            <span className="text-xs transition-transform group-open:rotate-90">›</span>
            Gesloten posities ({closedRows.length})
          </summary>
          <div className="divide-y divide-border border-t border-border">
            {closedRows.map(r => (
              <Link
                key={r.id}
                href={`/portfolio/aandelen-etf/${r.id}?from=${backTo}`}
                className="grid grid-cols-[1fr_auto] gap-4 items-center px-6 py-3 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {r.ticker && (
                    <span className="text-xs font-mono font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                      {r.ticker}
                    </span>
                  )}
                  <span className="text-sm font-medium text-foreground truncate">{r.name}</span>
                </div>
                <span className={`text-sm font-medium text-right w-32 ${r.realizedGain >= 0 ? 'text-sage' : 'text-terracotta'}`}>
                  {formatCurrency(r.realizedGain)}
                  <span className="block text-xs font-normal text-muted-foreground">gerealiseerd</span>
                </span>
              </Link>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}
