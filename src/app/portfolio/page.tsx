import Decimal from 'decimal.js'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/db/supabase-server'
import { getLiquidAssetsWithCalculations } from '@/lib/db/queries/assets'
import { getTransactionsByAssets } from '@/lib/db/queries/transactions'
import { getValuationTimeSeries, getMortgageBalanceTimeSeries } from '@/lib/db/queries/cashflow'
import { getPortfolioCategoryTotals } from '@/lib/db/queries/portfolio-summary'
import { calculateXirr, calculateAllocation, buildXirrCashflows, hasMinimumXirrPeriod } from '@/lib/finance'
import { buildNetWorthSeries } from '@/lib/finance'
import { formatCurrency, formatPercent } from '@/lib/utils/format'
import { Topbar } from '@/components/layout/Topbar'
import { KpiCard } from '@/components/ui/KpiCard'
import { NetWorthChart } from '@/components/vermogen/NetWorthChart'
import { AllocationChart } from '@/components/vermogen/AllocationChart'
import { getBenchmarkTwr } from '@/lib/services/benchmark'

const CATEGORY_LABELS: Record<string, string> = {
  stock_etf:   'Aandelen & ETF',
  crypto:      'Crypto',
  savings:     'Spaarrekeningen',
  real_estate: 'Vastgoed',
  pension:     'Pensioen',
  vordering:   'Vorderingen',
}

const CATEGORY_HREFS: Record<string, string> = {
  stock_etf:   '/portfolio/aandelen-etf',
  crypto:      '/portfolio/crypto',
  savings:     '/portfolio/spaarrekeningen',
  real_estate: '/portfolio/vastgoed',
  pension:     '/portfolio/pensioen',
  vordering:   '/portfolio/vorderingen',
}

export default async function PortfolioOverviewPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user!.id

  const currentYear = new Date().getFullYear()
  const ytdStart = `${currentYear}-01-01`

  const [categoryTotals, liquidAssets, valuationRows, mortgageBalanceRows] = await Promise.all([
    getPortfolioCategoryTotals(userId),
    getLiquidAssetsWithCalculations(userId),
    getValuationTimeSeries(userId),
    getMortgageBalanceTimeSeries(userId),
  ])

  const totalValue  = categoryTotals.reduce((s, c) => s.plus(c.value), new Decimal(0))
  const liquidValue = categoryTotals.filter(c => c.liquid).reduce((s, c) => s.plus(c.value), new Decimal(0))
  const illiquidValue = totalValue.minus(liquidValue)

  // Portfolio-XIRR YTD — bewust alleen liquide posities (aandelen/crypto/spaargeld)
  // met transactiehistorie. Vastgoed-XIRR mengt momenteel methodologieën (zie
  // STATUS.md R2) en simpele-invoerlijsten hebben geen transacties om op te
  // rekenen — daarom hier niet meegenomen i.p.v. een onbetrouwbaar getal tonen.
  const liquidAssetIds = liquidAssets.map(a => a.id)
  const totalLiquidTracked = liquidAssets.reduce((s, a) => s.plus(a.currentValue), new Decimal(0))
  let portfolioXirr: Decimal | null = null

  if (liquidAssetIds.length > 0 && totalLiquidTracked.gt(0)) {
    const ytdTxs = await getTransactionsByAssets(userId, liquidAssetIds, ytdStart)
    const cashflows = buildXirrCashflows(ytdTxs)

    const liquidAssetIdSet = new Set(liquidAssetIds)
    const ytdOpeningByAsset = new Map<string, Decimal>()
    for (const v of valuationRows) {
      if (liquidAssetIdSet.has(v.assetId) && v.valuationDate <= ytdStart) {
        ytdOpeningByAsset.set(v.assetId, new Decimal(v.value))
      }
    }
    const openingValue = [...ytdOpeningByAsset.values()].reduce((s, v) => s.plus(v), new Decimal(0))
    if (openingValue.gt(0)) {
      cashflows.unshift({ amount: openingValue.negated(), date: new Date(ytdStart) })
    }

    if (cashflows.length >= 1 && hasMinimumXirrPeriod(cashflows)) {
      cashflows.push({ amount: totalLiquidTracked, date: new Date() })
      try { portfolioXirr = calculateXirr(cashflows) } catch { /* insufficient data */ }
    }
  }

  const benchmarkTwr = await getBenchmarkTwr(new Date(ytdStart), new Date()).catch(() => null)

  // Vermogensontwikkeling — alle getrackte waarderingen (incl. vastgoed, netto
  // van hypotheek), zelfde opbouw als op de cashflow-pagina. Posities die via
  // de simpele invoerlijsten zijn vastgelegd hebben geen historie en verschijnen
  // dus niet in deze tijdlijn — wel al in de tegels/allocatie hierboven.
  const latestMortgageAtDate = (assetId: string, date: string) => {
    const relevant = mortgageBalanceRows.filter(m => m.assetId === assetId && m.balanceDate <= date)
    return relevant.length > 0
      ? new Decimal(relevant[relevant.length - 1].outstandingBalance)
      : new Decimal(0)
  }
  const series = buildNetWorthSeries(
    valuationRows.map(v => ({
      assetId:   v.assetId,
      date:      v.valuationDate,
      value:     new Decimal(v.value),
      liability: latestMortgageAtDate(v.assetId, v.valuationDate),
    })),
  )
  const chartData = series.map(p => ({ date: p.date, value: p.netWorth.toNumber() }))

  // AllocationChart is een Client Component — Decimal-instanties kunnen niet
  // over de server/client-grens, dus hier al naar plain numbers omzetten.
  const allocationSlices = calculateAllocation(
    categoryTotals.filter(c => c.value.gt(0)).map(c => ({ assetType: c.assetType, value: c.value })),
  ).map(s => ({ assetType: s.assetType, value: s.value.toNumber(), percentage: s.percentage.toNumber() }))

  return (
    <>
      <Topbar />
      <main className="mx-auto max-w-[1200px] px-8 py-12 space-y-6">

        <div>
          <h1 className="text-2xl font-semibold text-foreground">Portfolio</h1>
          <p className="mt-1 text-sm text-muted-foreground">Overzicht van al je beleggingen en bezittingen</p>
        </div>

        {totalValue.isZero() && (
          <div className="bg-card border border-border rounded-3xl p-12 text-center">
            <p className="text-sm text-muted-foreground">Nog geen beleggingen, spaargeld, vastgoed of pensioen toegevoegd.</p>
            <Link
              href="/assets/new"
              className="mt-3 inline-block px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Voeg iets toe
            </Link>
          </div>
        )}

        {/* KPI cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <KpiCard
            label="Totale portfoliowaarde"
            value={totalValue.gt(0) ? formatCurrency(totalValue.toNumber()) : '—'}
            subtext="Alle categorieën samen"
          />
          <KpiCard
            label="Liquide vermogen"
            value={liquidValue.gt(0) ? formatCurrency(liquidValue.toNumber()) : '—'}
            subtext={totalValue.gt(0)
              ? `${formatCurrency(illiquidValue.toNumber())} illiquide (vastgoed, pensioen, vorderingen)`
              : 'Direct beschikbaar'}
          />
          <KpiCard
            label="Rendement dit jaar"
            value={portfolioXirr ? formatPercent(portfolioXirr.toNumber()) : '—'}
            subtext="XIRR — aandelen, crypto, spaargeld"
            trend={portfolioXirr ? { value: formatPercent(portfolioXirr.toNumber()), positive: portfolioXirr.gt(0) } : undefined}
          />
          <KpiCard
            label="Marktrendement (MSCI World)"
            value={benchmarkTwr ? formatPercent(benchmarkTwr.toNumber()) : '—'}
            subtext="IWDA ETF (EUR), ter referentie"
          />
        </div>

        {/* Vermogensontwikkeling */}
        <NetWorthChart data={chartData} />

        {/* Allocatie */}
        <AllocationChart slices={allocationSlices} />

        {/* Categorieën */}
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-3">Categorieën</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {categoryTotals.map(({ assetType, value, liquid }) => (
              <Link
                key={assetType}
                href={CATEGORY_HREFS[assetType]}
                className="block bg-card border border-border rounded-3xl p-6 hover:border-sage/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground font-medium">{CATEGORY_LABELS[assetType]}</p>
                  <span className="text-xs text-muted-foreground">{liquid ? 'liquide' : 'illiquide'}</span>
                </div>
                <p className="mt-1 text-2xl font-semibold text-foreground">
                  {value.gt(0) ? formatCurrency(value.toNumber()) : '—'}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {totalValue.gt(0) && value.gt(0)
                    ? `${value.div(totalValue).mul(100).toDecimalPlaces(1)}% van portfolio`
                    : 'Nog niets geregistreerd'}
                </p>
              </Link>
            ))}
          </div>
        </div>

      </main>
    </>
  )
}
