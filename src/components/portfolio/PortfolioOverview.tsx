import Decimal from 'decimal.js'
import Link from 'next/link'
import { getAssetsWithValues } from '@/lib/db/queries/assets'
import { getTransactionsByAssetsDetailed } from '@/lib/db/queries/transactions'
import { getBrokers } from '@/lib/db/queries/brokers'
import { buildStockPortfolioSeries } from '@/lib/finance/stock-series'
import { buildInlegSeries } from '@/lib/finance/portfolio-series'
import { calculateNetDeposit, calculateXirr, buildXirrCashflows, hasMinimumXirrPeriod } from '@/lib/finance'
import { formatCurrency, formatPercent } from '@/lib/utils/format'
import { Topbar } from '@/components/layout/Topbar'
import { KpiCard } from '@/components/ui/KpiCard'
import { PortfolioInlegChart } from '@/components/portfolio/PortfolioInlegChart'
import { AllocationBreakdown } from '@/components/portfolio/AllocationBreakdown'
import { PortfolioGroupTable } from '@/components/portfolio/PortfolioGroupTable'
import type { PortfolioConfig } from '@/types/portfolio'
import type { AllocationItem } from '@/components/portfolio/AllocationBreakdown'

type AssetWithValue = Awaited<ReturnType<typeof getAssetsWithValues>>[number]

const INSTRUMENT_LABELS: Record<string, string> = {
  stock: 'Aandelen',
  etf:   'ETFs',
  fund:  'Indexfondsen',
}

export async function PortfolioOverview({ config, userId }: {
  config: PortfolioConfig
  userId: string
}) {
  const allAssets = await getAssetsWithValues(userId)
  const assets = allAssets.filter(a => a.assetType === config.assetType)
  const assetIds = assets.map(a => a.id)
  const allTxs = assetIds.length > 0 ? await getTransactionsByAssetsDetailed(assetIds) : []

  // ─── KPI's ───────────────────────────────────────────────────────────────────
  const totaleWaarde = assets.reduce((s, a) => s.plus(a.currentValue), new Decimal(0))
  const netDeposit   = calculateNetDeposit(allTxs)
  const winst        = totaleWaarde.minus(netDeposit)

  // ─── Portfolio XIRR ───────────────────────────────────────────────────────────
  // Bron van waarheid conform finance-logic.md §6 — zie lib/finance/xirr-cashflows.ts
  let portfolioXirr: Decimal | null = null
  const xirrFlows = buildXirrCashflows(allTxs)
  if (xirrFlows.length >= 1 && totaleWaarde.gt(0) && hasMinimumXirrPeriod(xirrFlows)) {
    xirrFlows.push({ amount: totaleWaarde, date: new Date() })
    try {
      portfolioXirr = calculateXirr(xirrFlows)
    } catch {
      portfolioXirr = null
    }
  }

  // ─── Brokers (stock_etf only) ─────────────────────────────────────────────────
  const brokerList = config.assetType === 'stock_etf' ? await getBrokers(userId) : []
  const brokerById = new Map(brokerList.map(b => [b.id, b.name]))

  // ─── Pagina-subtitel ─────────────────────────────────────────────────────────
  const pageSubtitle = config.assetType === 'stock_etf'
    ? `${brokerList.length} broker${brokerList.length !== 1 ? 's' : ''} · ${assets.length} positie${assets.length !== 1 ? 's' : ''}`
    : `${assets.length} positie${assets.length !== 1 ? 's' : ''} · cryptocurrency posities`

  // ─── Grafiek (stock_etf only) ─────────────────────────────────────────────────
  let chartData: Awaited<ReturnType<typeof buildStockPortfolioSeries>> = []
  if (config.showChart) {
    const tickerByAssetId = new Map<string, string>()
    for (const a of assets) {
      const ticker = a.stockEtfDetails?.ticker ?? a.cryptoDetails?.ticker
      if (ticker) tickerByAssetId.set(a.id, ticker)
    }
    const series = await buildStockPortfolioSeries(allTxs, tickerByAssetId)
    chartData = series.length > 0
      ? series
      : buildInlegSeries(allTxs.map(t => ({ transactionType: t.transactionType, amount: t.amount, transactionDate: t.transactionDate })))
  }

  // ─── Allocatie (stock_etf only) ───────────────────────────────────────────────
  let sectorItems: AllocationItem[] = []
  let typeItems:   AllocationItem[] = []

  if (config.showAllocation) {
    const sectorMap = new Map<string, Decimal>()
    const typeMap   = new Map<string, Decimal>()
    for (const a of assets) {
      if (a.currentValue.lte(0)) continue
      const sector = a.stockEtfDetails?.sector?.trim() || 'Overig'
      const type   = a.stockEtfDetails?.instrumentType ?? 'stock'
      sectorMap.set(sector, (sectorMap.get(sector) ?? new Decimal(0)).plus(a.currentValue))
      typeMap.set(type,     (typeMap.get(type)     ?? new Decimal(0)).plus(a.currentValue))
    }
    const toItems = (map: Map<string, Decimal>): AllocationItem[] =>
      [...map.entries()]
        .sort((a, b) => b[1].minus(a[1]).toNumber())
        .map(([label, val]) => ({
          label,
          value: val.toNumber(),
          pct: totaleWaarde.gt(0) ? val.div(totaleWaarde).toNumber() : 0,
        }))
    sectorItems = toItems(sectorMap)
    typeItems   = toItems(typeMap).map(item => ({
      ...item,
      label: INSTRUMENT_LABELS[item.label] ?? item.label,
    }))
  }

  // ─── Per-asset netDeposit & tabelrijen ────────────────────────────────────────
  const netDepositByAsset = new Map<string, Decimal>()
  for (const a of assets) {
    netDepositByAsset.set(a.id, calculateNetDeposit(allTxs.filter(t => t.assetId === a.id)))
  }

  const groupRows = assets.map(a => ({
    id:           a.id,
    name:         a.name,
    ticker:       config.assetType === 'stock_etf'
      ? (a.stockEtfDetails?.ticker ?? null)
      : (a.cryptoDetails?.ticker ?? null),
    groupKey:     config.assetType === 'stock_etf'
      ? (brokerById.get(a.stockEtfDetails?.brokerId ?? '') ?? config.emptyGroupLabel)
      : (a.cryptoDetails?.walletOrExchange || config.emptyGroupLabel),
    groupId:      config.assetType === 'stock_etf' ? (a.stockEtfDetails?.brokerId ?? null) : null,
    currentValue: a.currentValue,
    netDeposit:   netDepositByAsset.get(a.id) ?? new Decimal(0),
    // Volledig verkocht (quantityHeld = 0): toon apart met gerealiseerd resultaat
    // i.p.v. te verdwijnen tussen de actieve posities met een lege W/V-kolom.
    isClosed:     a.quantityHeld !== null && a.quantityHeld.lte(0),
    realizedGain: a.realizedGain ?? new Decimal(0),
    detailHref:   `${config.detailBasePath}/${a.id}`,
  }))

  return (
    <>
      <Topbar />
      <main className="mx-auto max-w-[1200px] px-8 py-12 space-y-8">

        <div>
          <h1 className="text-2xl font-semibold text-foreground">{config.pageTitle}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{pageSubtitle}</p>
        </div>

        {/* KPI's */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            label="Marktwaarde"
            value={formatCurrency(totaleWaarde.toNumber())}
            subtext="Live koersen"
          />
          <KpiCard
            label="Netto inleg"
            value={netDeposit.gt(0) ? formatCurrency(netDeposit.toNumber()) : '—'}
            subtext="Aankopen minus verkopen"
          />
          <KpiCard
            label="Totaalrendement"
            value={netDeposit.gt(0) ? formatCurrency(winst.toNumber()) : '—'}
            subtext={netDeposit.gt(0)
              ? `${formatPercent(winst.div(netDeposit).toNumber())} sinds start`
              : undefined}
            trend={netDeposit.gt(0) ? { value: '', positive: winst.gte(0) } : undefined}
          />
          <KpiCard
            label="Rendement (XIRR)"
            value={portfolioXirr ? formatPercent(portfolioXirr.toNumber()) : '—'}
            subtext={portfolioXirr ? 'Jaarlijks, incl. timing van inleg' : 'Te weinig data'}
            trend={portfolioXirr ? { value: '', positive: portfolioXirr.gt(0) } : undefined}
          />
        </div>

        {config.assetType === 'stock_etf' && (
          <div className="flex justify-end -mt-4">
            <Link
              href="/portfolio/aandelen-etf/rendement"
              className="text-sm text-primary hover:underline"
            >
              Rendement per jaar bekijken →
            </Link>
          </div>
        )}

        {/* Grafiek (aandelen only) */}
        {config.showChart && <PortfolioInlegChart data={chartData} title="Portefeuille ontwikkeling" />}

        {/* Allocatie (aandelen only) */}
        {config.showAllocation && (sectorItems.length > 0 || typeItems.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sectorItems.length > 0 && <AllocationBreakdown title="Sector" items={sectorItems} />}
            {typeItems.length > 0   && <AllocationBreakdown title="Type instrument" items={typeItems} />}
          </div>
        )}

        {/* Posities */}
        {assets.length > 0 ? (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-foreground">{config.sectionTitle}</h2>
              <div className="flex items-center gap-4">
                {config.secondaryActionHref && (
                  <Link
                    href={config.secondaryActionHref}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {config.secondaryActionLabel}
                  </Link>
                )}
                <Link
                  href={config.newAssetHref}
                  className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  {config.newAssetLabel}
                </Link>
              </div>
            </div>
            <PortfolioGroupTable
              rows={groupRows}
              emptyGroupLabel={config.emptyGroupLabel}
              groupDetailBasePath={config.groupDetailBasePath}
            />
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-12 text-center">
            <p className="text-sm text-muted-foreground mb-4">{config.emptyMessage}</p>
            <div className="flex items-center justify-center gap-4">
              <Link
                href={config.newAssetHref}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
              >
                {config.newAssetLabel}
              </Link>
              {config.secondaryActionHref && (
                <Link
                  href={config.secondaryActionHref}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {config.secondaryActionLabel}
                </Link>
              )}
            </div>
          </div>
        )}

      </main>
    </>
  )
}
