import Decimal from 'decimal.js'
import { createServerSupabaseClient } from '@/lib/db/supabase-server'
import { getLiquidAssetsWithCalculations, getAssetsWithValues } from '@/lib/db/queries/assets'
import { calculateXirr, calculateAllocation, calculateExcessReturn } from '@/lib/finance'
import { buildNetWorthSeries } from '@/lib/finance'
import { formatCurrency, formatPercent } from '@/lib/utils/format'
import { Topbar } from '@/components/layout/Topbar'
import { KpiCard } from '@/components/ui/KpiCard'
import { NetWorthChart } from '@/components/vermogen/NetWorthChart'
import { AssetTable } from '@/components/vermogen/AssetTable'
import { AllocationChart } from '@/components/vermogen/AllocationChart'
import { getBenchmarkTwr } from '@/lib/services/benchmark'
import { getOrCreateTenant } from '@/lib/db/queries/tenant'
import { db } from '@/lib/db'
import { transactions, assets, assetValuations } from '@/lib/db/schema'
import { and, eq, gte, inArray, asc } from 'drizzle-orm'

const LIQUID_TYPES = ['stock_etf', 'crypto', 'savings']

export default async function VermogenPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user!.id

  const [liquidAssets, allAssets] = await Promise.all([
    getLiquidAssetsWithCalculations(userId),
    getAssetsWithValues(userId),
  ])

  // Totaal vermogen liquide assets
  const totalLiquid = liquidAssets.reduce((sum, a) => sum.plus(a.currentValue), new Decimal(0))

  // Portfolio XIRR YTD — alle transacties van liquide assets vanaf 1 jan huidig jaar
  const currentYear = new Date().getFullYear()
  const ytdStart = `${currentYear}-01-01`

  const tenantId = await getOrCreateTenant(userId)
  const liquidAssetIds = allAssets
    .filter(a => LIQUID_TYPES.includes(a.assetType))
    .map(a => a.id)

  let portfolioXirr: Decimal | null = null

  if (liquidAssetIds.length > 0 && totalLiquid.gt(0)) {
    const ytdTxs = await db
      .select()
      .from(transactions)
      .innerJoin(assets, eq(assets.id, transactions.assetId))
      .where(
        and(
          inArray(transactions.assetId, liquidAssetIds),
          gte(transactions.transactionDate, ytdStart),
        ),
      )
      .orderBy(asc(transactions.transactionDate))

    const cashflows = ytdTxs
      .filter(r => ['buy', 'sell', 'deposit', 'withdrawal'].includes(r.transactions.transactionType))
      .map(r => {
        const sign = r.transactions.transactionType === 'buy' || r.transactions.transactionType === 'deposit' ? -1 : 1
        return { amount: new Decimal(r.transactions.amount).mul(sign), date: new Date(r.transactions.transactionDate) }
      })

    if (cashflows.length >= 1) {
      cashflows.push({ amount: totalLiquid, date: new Date() })
      try { portfolioXirr = calculateXirr(cashflows) } catch { /* insufficient data */ }
    }
  }

  // Allocatie op basis van alle assets (inclusief vastgoed + pensioen)
  const allocationSlices = calculateAllocation(
    allAssets.map(a => ({ assetType: a.assetType, value: a.currentValue })),
  )

  // Benchmark URTH TWR YTD
  const benchmarkTwr = await getBenchmarkTwr(new Date(ytdStart), new Date()).catch(() => null)
  const excessReturn = portfolioXirr && benchmarkTwr
    ? calculateExcessReturn(portfolioXirr, benchmarkTwr)
    : null

  // Vermogensontwikkeling tijdreeks — op basis van asset valuations
  const valuationRows = await db
    .select({
      assetId:       assetValuations.assetId,
      valuationDate: assetValuations.valuationDate,
      value:         assetValuations.value,
    })
    .from(assetValuations)
    .innerJoin(assets, eq(assets.id, assetValuations.assetId))
    .where(eq(assets.tenantId, tenantId))
    .orderBy(asc(assetValuations.valuationDate))

  const series = buildNetWorthSeries(
    valuationRows.map(v => ({
      assetId: v.assetId,
      date: v.valuationDate,
      value: new Decimal(v.value),
      liability: new Decimal(0),
    })),
  )

  const chartData = series.map(p => ({ date: p.date, value: p.netWorth.toNumber() }))

  return (
    <>
      <Topbar />
      <main className="mx-auto max-w-[1200px] px-8 py-12 space-y-6">

        <div>
          <h1 className="text-2xl font-semibold text-foreground">Vermogen</h1>
          <p className="mt-1 text-sm text-muted-foreground">Liquide portfolio — aandelen, crypto en spaargeld</p>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <KpiCard
            label="Totaal vermogen"
            value={totalLiquid.gt(0) ? formatCurrency(totalLiquid.toNumber()) : '—'}
            subtext="Aandelen, crypto en spaargeld"
          />
          <KpiCard
            label="Rendement dit jaar"
            value={portfolioXirr ? formatPercent(portfolioXirr.toNumber()) : '—'}
            subtext={`Intern rendement ${currentYear}`}
            trend={portfolioXirr ? { value: formatPercent(portfolioXirr.toNumber()), positive: portfolioXirr.gt(0) } : undefined}
          />
          <KpiCard
            label="vs. URTH benchmark"
            value={excessReturn ? `${excessReturn.gte(0) ? '+' : ''}${formatPercent(excessReturn.toNumber())}` : '—'}
            subtext={benchmarkTwr ? `Benchmark: ${formatPercent(benchmarkTwr.toNumber())}` : 'Benchmark niet beschikbaar'}
            trend={excessReturn ? { value: '', positive: excessReturn.gte(0) } : undefined}
          />
        </div>

        {/* Vermogensontwikkeling grafiek */}
        <NetWorthChart data={chartData} />

        {/* Asset tabel */}
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-3">Posities</h2>
          <AssetTable assets={liquidAssets} />
        </div>

        {/* Allocatie donut */}
        <AllocationChart slices={allocationSlices} />

      </main>
    </>
  )
}
