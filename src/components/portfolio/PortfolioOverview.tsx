import Decimal from 'decimal.js'
import Link from 'next/link'
import { getAssetsWithValues } from '@/lib/db/queries/assets'
import { getTransactionsByAssetsDetailed } from '@/lib/db/queries/transactions'
import { getBrokers } from '@/lib/db/queries/brokers'
import { buildStockPortfolioSeries } from '@/lib/finance/stock-series'
import { buildInlegSeries } from '@/lib/finance/portfolio-series'
import { calculateNetDeposit } from '@/lib/finance'
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
  const rendement    = netDeposit.gt(0) ? winst.div(netDeposit) : null

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
      if (a.stockEtfDetails?.ticker) tickerByAssetId.set(a.id, a.stockEtfDetails.ticker)
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

  // ─── Broker stats (stock_etf only) ───────────────────────────────────────────
  const netDepositByAsset = new Map<string, Decimal>()
  if (config.assetType === 'stock_etf') {
    for (const a of assets) {
      const assetTxs = allTxs.filter(t => t.assetId === a.id)
      netDepositByAsset.set(a.id, calculateNetDeposit(assetTxs))
    }
  }

  const assetsByBroker = new Map<string, AssetWithValue[]>()
  for (const a of assets) {
    const key = a.stockEtfDetails?.brokerId ?? ''
    if (!assetsByBroker.has(key)) assetsByBroker.set(key, [])
    assetsByBroker.get(key)!.push(a)
  }

  const brokerStats = brokerList.map(broker => {
    const positions = assetsByBroker.get(broker.id) ?? []
    const waarde    = positions.reduce((s, a) => s.plus(a.currentValue), new Decimal(0))
    const inleg     = positions.reduce((s, a) => s.plus(netDepositByAsset.get(a.id) ?? 0), new Decimal(0))
    const wv        = waarde.minus(inleg)
    const pct       = inleg.gt(0) ? wv.div(inleg) : null
    return { broker, positions, waarde, inleg, wv, pct }
  })

  // ─── Crypto groepering (crypto only) ─────────────────────────────────────────
  const cryptoNetDepositByAsset = new Map<string, Decimal>()
  let cryptoGroupRows: Parameters<typeof PortfolioGroupTable>[0]['rows'] = []

  if (config.assetType === 'crypto') {
    for (const a of assets) {
      const assetTxs = allTxs.filter(t => t.assetId === a.id)
      cryptoNetDepositByAsset.set(a.id, calculateNetDeposit(assetTxs))
    }
    cryptoGroupRows = assets.map(a => ({
      id:           a.id,
      name:         a.name,
      ticker:       a.cryptoDetails?.ticker ?? null,
      groupKey:     a.cryptoDetails?.walletOrExchange || config.emptyGroupLabel,
      currentValue: a.currentValue,
      netDeposit:   cryptoNetDepositByAsset.get(a.id) ?? new Decimal(0),
      detailHref:   `${config.detailBasePath}/${a.id}`,
    }))
  }

  const hasAssets = assets.length > 0

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
            label="Winst / verlies"
            value={netDeposit.gt(0) ? formatCurrency(winst.toNumber()) : '—'}
            subtext={rendement ? formatPercent(rendement.toNumber()) : undefined}
            trend={netDeposit.gt(0) ? { value: '', positive: winst.gte(0) } : undefined}
          />
          <KpiCard
            label="Rendement"
            value={rendement ? formatPercent(rendement.toNumber()) : '—'}
            subtext="Op netto inleg"
            trend={rendement ? { value: '', positive: winst.gte(0) } : undefined}
          />
        </div>

        {/* Grafiek (aandelen only) */}
        {config.showChart && <PortfolioInlegChart data={chartData} title="Portefeuille ontwikkeling" />}

        {/* Allocatie (aandelen only) */}
        {config.showAllocation && (sectorItems.length > 0 || typeItems.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sectorItems.length > 0 && <AllocationBreakdown title="Sector" items={sectorItems} />}
            {typeItems.length > 0   && <AllocationBreakdown title="Type instrument" items={typeItems} />}
          </div>
        )}

        {/* Posities / broker-tabel */}
        {hasAssets ? (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-foreground">{config.sectionTitle}</h2>
              <Link
                href={config.newAssetHref}
                className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
              >
                {config.newAssetLabel}
              </Link>
            </div>

            {/* Broker-tabel (aandelen) */}
            {config.assetType === 'stock_etf' && (
              <div className="rounded-2xl border border-border bg-card overflow-hidden">
                <div className="hidden md:grid grid-cols-[1fr_auto_auto_auto_auto] gap-6 px-6 py-2.5 border-b border-border bg-muted/30">
                  <span className="text-xs text-muted-foreground">Broker</span>
                  <span className="text-xs text-muted-foreground text-right w-28">Waarde</span>
                  <span className="text-xs text-muted-foreground text-right w-28">Netto inleg</span>
                  <span className="text-xs text-muted-foreground text-right w-28">W/V</span>
                  <span className="text-xs text-muted-foreground text-right w-20">%</span>
                </div>
                <div className="divide-y divide-border">
                  {brokerStats.map(({ broker, positions, waarde, inleg, wv, pct }) => (
                    <Link
                      key={broker.id}
                      href={`/portfolio/aandelen-etf/broker/${broker.id}`}
                      className="grid grid-cols-[1fr_auto] md:grid-cols-[1fr_auto_auto_auto_auto] gap-6 items-center px-6 py-4 hover:bg-muted/50 transition-colors"
                    >
                      <div>
                        <p className="text-sm font-medium text-foreground">{broker.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {positions.length} positie{positions.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-foreground text-right w-28">
                        {positions.length > 0 ? formatCurrency(waarde.toNumber()) : '—'}
                      </span>
                      <span className="text-sm text-muted-foreground text-right w-28 hidden md:block">
                        {inleg.gt(0) ? formatCurrency(inleg.toNumber()) : '—'}
                      </span>
                      <span className={`text-sm font-medium text-right w-28 hidden md:block ${inleg.gt(0) ? (wv.gte(0) ? 'text-sage' : 'text-terracotta') : 'text-muted-foreground'}`}>
                        {inleg.gt(0) ? formatCurrency(wv.toNumber()) : '—'}
                      </span>
                      <span className={`text-sm font-medium text-right w-20 hidden md:block ${pct ? (pct.gte(0) ? 'text-sage' : 'text-terracotta') : 'text-muted-foreground'}`}>
                        {pct ? formatPercent(pct.toNumber()) : '—'}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Asset-tabel gegroepeerd per wallet/exchange (crypto) */}
            {config.assetType === 'crypto' && (
              <PortfolioGroupTable rows={cryptoGroupRows} emptyGroupLabel={config.emptyGroupLabel} />
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-12 text-center">
            <p className="text-sm text-muted-foreground mb-4">{config.emptyMessage}</p>
            <Link
              href={config.newAssetHref}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
            >
              {config.newAssetLabel}
            </Link>
          </div>
        )}

      </main>
    </>
  )
}
