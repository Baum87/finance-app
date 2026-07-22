import Link from 'next/link'
import Decimal from 'decimal.js'
import { formatCurrency, formatPercent } from '@/lib/utils/format'

export type GroupedAssetRow = {
  id: string
  name: string
  ticker: string | null
  groupKey: string
  /** Entity-id achter de groep (bijv. brokerId) — alleen gezet als er een detailpagina voor bestaat. */
  groupId?: string | null
  currentValue: Decimal
  netDeposit: Decimal
  /** Volledig verkocht (quantityHeld = 0) — wordt apart getoond, niet tussen de actieve posities. */
  isClosed: boolean
  /** Gerealiseerd resultaat (AVCO) — de W/V-vervanger voor gesloten posities. */
  realizedGain: Decimal
  detailHref: string
}

export function PortfolioGroupTable({ rows, emptyGroupLabel, groupDetailBasePath }: {
  rows: GroupedAssetRow[]
  emptyGroupLabel: string
  /** Basispad voor groep-detailpagina's, bijv. "/portfolio/aandelen-etf/broker". Zonder deze prop blijft de groepnaam platte tekst. */
  groupDetailBasePath?: string
}) {
  const openRows = rows.filter(r => !r.isClosed)
  const closedRows = rows.filter(r => r.isClosed)

  const groupMap = new Map<string, GroupedAssetRow[]>()
  for (const r of openRows) {
    const key = r.groupKey || emptyGroupLabel
    if (!groupMap.has(key)) groupMap.set(key, [])
    groupMap.get(key)!.push(r)
  }

  return (
    <div className="space-y-3">
      {openRows.length > 0 && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="hidden md:grid grid-cols-[1fr_auto_auto_auto_auto] gap-6 px-6 py-2.5 border-b border-border bg-muted/30">
            <span className="text-xs text-muted-foreground">Asset</span>
            <span className="text-xs text-muted-foreground text-right w-28">Waarde</span>
            <span className="text-xs text-muted-foreground text-right w-28">Netto inleg</span>
            <span className="text-xs text-muted-foreground text-right w-28">W/V</span>
            <span className="text-xs text-muted-foreground text-right w-20">%</span>
          </div>
          {[...groupMap.entries()].map(([group, groupRows]) => {
            const groupId       = groupRows[0]?.groupId
            const groupHref     = groupDetailBasePath && groupId ? `${groupDetailBasePath}/${groupId}` : null
            const groupWaarde   = groupRows.reduce((s, r) => s.plus(r.currentValue), new Decimal(0))
            const groupInleg    = groupRows.reduce((s, r) => s.plus(r.netDeposit), new Decimal(0))
            const groupWv       = groupWaarde.minus(groupInleg)
            const groupPct      = groupInleg.gt(0) ? groupWv.div(groupInleg) : null
            const groupHeaderClass = 'relative grid grid-cols-[1fr_auto] md:grid-cols-[1fr_auto_auto_auto_auto] gap-6 items-center px-6 py-2.5 bg-muted/20 border-t border-border'

            return (
            <div key={group}>
              <div className={`${groupHeaderClass} ${groupHref ? 'hover:bg-muted/40 transition-colors' : ''}`}>
                {/* Stretched link: maakt de hele rij klikbaar zonder de "Transacties
                    importeren"-link (die zelf ook een <a> is) erin te nesten. */}
                {groupHref && <Link href={groupHref} className="absolute inset-0" />}

                <span className={`relative z-10 text-xs font-medium truncate flex items-center gap-3 ${groupHref ? 'text-foreground' : 'text-muted-foreground'}`}>
                  <span className="truncate">{group}{groupHref && ' ›'}</span>
                  {groupHref && (
                    <Link href={`${groupHref}/import`} className="shrink-0 font-normal text-primary hover:underline">
                      Transacties importeren
                    </Link>
                  )}
                </span>
                <span className="relative z-10 text-xs font-medium text-muted-foreground text-right w-28">
                  {formatCurrency(groupWaarde.toNumber())}
                </span>
                <span className="relative z-10 text-xs font-medium text-muted-foreground text-right w-28 hidden md:block">
                  {groupInleg.gt(0) ? formatCurrency(groupInleg.toNumber()) : '—'}
                </span>
                <span className={`relative z-10 text-xs font-medium text-right w-28 hidden md:block ${groupInleg.gt(0) ? (groupWv.gte(0) ? 'text-sage' : 'text-terracotta') : 'text-muted-foreground'}`}>
                  {groupInleg.gt(0) ? formatCurrency(groupWv.toNumber()) : '—'}
                </span>
                <span className={`relative z-10 text-xs font-medium text-right w-20 hidden md:block ${groupPct ? (groupPct.gte(0) ? 'text-sage' : 'text-terracotta') : 'text-muted-foreground'}`}>
                  {groupPct ? formatPercent(groupPct.toNumber()) : '—'}
                </span>
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
                      <div className="flex items-center gap-2.5 min-w-0">
                        {r.ticker && (
                          <span className="text-xs font-mono font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                            {r.ticker}
                          </span>
                        )}
                        <p className="text-sm font-medium text-foreground truncate">{r.name}</p>
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
            )
          })}
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
                href={r.detailHref}
                className="grid grid-cols-[1fr_auto] gap-6 items-center px-6 py-3 hover:bg-muted/50 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{r.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {r.ticker && `${r.ticker} · `}{r.groupKey || emptyGroupLabel}
                  </p>
                </div>
                <span className={`text-sm font-medium text-right w-32 ${r.realizedGain.gte(0) ? 'text-sage' : 'text-terracotta'}`}>
                  {formatCurrency(r.realizedGain.toNumber())}
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
