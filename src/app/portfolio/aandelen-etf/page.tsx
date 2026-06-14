import Decimal from 'decimal.js'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/db/supabase-server'
import { getAssetsWithValues } from '@/lib/db/queries/assets'
import { getTransactionsByAssetsDetailed } from '@/lib/db/queries/transactions'
import { getBrokers } from '@/lib/db/queries/brokers'
import { buildStockPortfolioSeries } from '@/lib/finance/stock-series'
import { buildInlegSeries } from '@/lib/finance/portfolio-series'
import { formatCurrency, formatPercent } from '@/lib/utils/format'
import { Topbar } from '@/components/layout/Topbar'
import { KpiCard } from '@/components/ui/KpiCard'
import { PortfolioInlegChart } from '@/components/portfolio/PortfolioInlegChart'
import { AllocationBreakdown } from '@/components/portfolio/AllocationBreakdown'
import type { AllocationItem } from '@/components/portfolio/AllocationBreakdown'

const INSTRUMENT_LABELS: Record<string, string> = {
  stock: 'Aandelen',
  etf:   'ETFs',
  fund:  'Indexfondsen',
}

export default async function AandelenEtfPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [allAssets, brokerList] = await Promise.all([
    getAssetsWithValues(user!.id),
    getBrokers(user!.id),
  ])

  const assets = allAssets.filter(a => a.assetType === 'stock_etf')
  const assetIds = assets.map(a => a.id)
  const detailedTxs = assetIds.length > 0 ? await getTransactionsByAssetsDetailed(assetIds) : []

  // ─── KPI's — netto inleg (buys − sell-opbrengsten) ───────────────────────────

  const totaleWaarde = assets.reduce((s, a) => s.plus(a.currentValue), new Decimal(0))

  let totaleKopen   = new Decimal(0)
  let totaleVerkopen = new Decimal(0)
  for (const t of detailedTxs) {
    if (t.transactionType === 'buy')  totaleKopen   = totaleKopen.plus(t.amount)
    if (t.transactionType === 'sell') totaleVerkopen = totaleVerkopen.plus(t.amount)
  }
  const nettoInleg  = totaleKopen.minus(totaleVerkopen)
  const winstVerlies = totaleWaarde.minus(nettoInleg)
  const rendement    = nettoInleg.gt(0) ? winstVerlies.div(nettoInleg) : null
  const isPositief   = winstVerlies.gte(0)

  // ─── Grafiek ─────────────────────────────────────────────────────────────────

  const tickerByAssetId = new Map<string, string>()
  for (const a of assets) {
    if (a.stockEtfDetails?.ticker) tickerByAssetId.set(a.id, a.stockEtfDetails.ticker)
  }

  const chartData = await buildStockPortfolioSeries(detailedTxs, tickerByAssetId)
  const fallbackData = chartData.length === 0
    ? buildInlegSeries(detailedTxs.map(t => ({ transactionType: t.transactionType, amount: t.amount, transactionDate: t.transactionDate })))
    : chartData

  // ─── Allocatie ───────────────────────────────────────────────────────────────

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

  const sectorItems = toItems(sectorMap)
  const typeItems   = toItems(typeMap).map(item => ({
    ...item,
    label: INSTRUMENT_LABELS[item.label] ?? item.label,
  }))

  // ─── Per broker (netto inleg per asset) ──────────────────────────────────────

  const nettoInlegByAsset = new Map<string, Decimal>()
  for (const tx of detailedTxs) {
    const prev = nettoInlegByAsset.get(tx.assetId) ?? new Decimal(0)
    if (tx.transactionType === 'buy')  nettoInlegByAsset.set(tx.assetId, prev.plus(tx.amount))
    if (tx.transactionType === 'sell') nettoInlegByAsset.set(tx.assetId, prev.minus(tx.amount))
  }

  const assetsByBroker = new Map<string, typeof assets>()
  for (const a of assets) {
    const name = a.stockEtfDetails?.broker?.trim() ?? ''
    if (!assetsByBroker.has(name)) assetsByBroker.set(name, [])
    assetsByBroker.get(name)!.push(a)
  }

  const brokerStats = brokerList.map(broker => {
    const positions = assetsByBroker.get(broker.name) ?? []
    const waarde    = positions.reduce((s, a) => s.plus(a.currentValue), new Decimal(0))
    const inleg     = positions.reduce((s, a) => s.plus(nettoInlegByAsset.get(a.id) ?? 0), new Decimal(0))
    const wv        = waarde.minus(inleg)
    const pct       = inleg.gt(0) ? wv.div(inleg) : null
    return { broker, positions, waarde, inleg, wv, pct }
  })

  return (
    <>
      <Topbar />
      <main className="mx-auto max-w-[1200px] px-8 py-12 space-y-8">

        <div>
          <h1 className="text-2xl font-semibold text-foreground">Aandelen &amp; ETFs</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {brokerList.length} broker{brokerList.length !== 1 ? 's' : ''} · {assets.length} positie{assets.length !== 1 ? 's' : ''}
          </p>
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
            value={nettoInleg.gt(0) ? formatCurrency(nettoInleg.toNumber()) : '—'}
            subtext="Gekocht minus onttrokken"
          />
          <KpiCard
            label="Winst / verlies"
            value={nettoInleg.gt(0) ? formatCurrency(winstVerlies.toNumber()) : '—'}
            subtext={rendement ? formatPercent(rendement.toNumber()) : undefined}
            trend={nettoInleg.gt(0) ? { value: '', positive: isPositief } : undefined}
          />
          <KpiCard
            label="Rendement"
            value={rendement ? formatPercent(rendement.toNumber()) : '—'}
            subtext="Op netto inleg"
            trend={rendement ? { value: '', positive: isPositief } : undefined}
          />
        </div>

        {/* Grafiek */}
        <PortfolioInlegChart data={fallbackData} title="Portefeuille ontwikkeling" />

        {/* Allocatie */}
        {(sectorItems.length > 0 || typeItems.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sectorItems.length > 0 && <AllocationBreakdown title="Sector" items={sectorItems} />}
            {typeItems.length > 0   && <AllocationBreakdown title="Type instrument" items={typeItems} />}
          </div>
        )}

        {/* Brokers */}
        {brokerList.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-12 text-center">
            <p className="text-sm text-muted-foreground mb-4">Nog geen brokers toegevoegd.</p>
            <Link
              href="/portfolio/aandelen-etf/broker/new"
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
            >
              + Broker toevoegen
            </Link>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-foreground">Brokers</h2>
              <Link
                href="/portfolio/aandelen-etf/broker/new"
                className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
              >
                + Broker toevoegen
              </Link>
            </div>
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
          </div>
        )}

      </main>
    </>
  )
}
