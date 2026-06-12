import Decimal from 'decimal.js'
import { createServerSupabaseClient } from '@/lib/db/supabase-server'
import { getPassiveIncomeData, getNetWorthAtDate, getValuationTimeSeries, getMortgageBalanceTimeSeries } from '@/lib/db/queries/cashflow'
import { getAssetsWithValues, getMortgageBalancesMap } from '@/lib/db/queries/assets'
import { calculateNetWorth } from '@/lib/finance'
import { buildNetWorthSeries } from '@/lib/finance'
import { formatCurrency } from '@/lib/utils/format'
import { Topbar } from '@/components/layout/Topbar'
import { KpiCard } from '@/components/ui/KpiCard'
import { PassiveIncomeBreakdown } from '@/components/cashflow/PassiveIncomeBreakdown'
import { NetWorthChart } from '@/components/vermogen/NetWorthChart'

function toDateStr(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export default async function CashflowPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user!.id

  const today = new Date()
  const currentYear = today.getFullYear()
  const ytdFrom = `${currentYear}-01-01`
  const todayStr = toDateStr(today)

  const [txData, assets_, mortgageMap, networthJan1, valuationRows, mortgageBalanceRows] = await Promise.all([
    getPassiveIncomeData(userId, ytdFrom, todayStr),
    getAssetsWithValues(userId),
    getMortgageBalancesMap(userId),
    getNetWorthAtDate(userId, ytdFrom),
    getValuationTimeSeries(userId),
    getMortgageBalanceTimeSeries(userId),
  ])

  // Passief inkomen YTD
  const dividend  = txData.filter(t => t.transactionType === 'dividend').reduce((s, t) => s.plus(t.amount), new Decimal(0))
  const interest  = txData.filter(t => t.transactionType === 'interest').reduce((s, t) => s.plus(t.amount), new Decimal(0))
  const rentalIn  = txData.filter(t => t.transactionType === 'rental_income').reduce((s, t) => s.plus(t.amount), new Decimal(0))
  const costs     = txData.filter(t => t.transactionType === 'cost').reduce((s, t) => s.plus(t.amount), new Decimal(0))
  const rentalNet = rentalIn.minus(costs)
  const totalPassive = dividend.plus(interest).plus(rentalNet)

  // Netto vermogen vandaag
  const networthToday = calculateNetWorth(
    assets_.map(a => ({
      value:     a.currentValue,
      liability: mortgageMap.get(a.id) ?? new Decimal(0),
    })),
  )

  const networthGrowth = networthJan1 != null ? networthToday.minus(networthJan1) : null
  const growthPositive = networthGrowth?.gte(0) ?? true

  const latestMortgageAtDate = (assetId: string, date: string) => {
    const relevant = mortgageBalanceRows
      .filter(m => m.assetId === assetId && m.balanceDate <= date)
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

  return (
    <>
      <Topbar />
      <main className="mx-auto max-w-[1200px] px-8 py-12 space-y-6">

        <div>
          <h1 className="text-2xl font-semibold text-foreground">Cashflow</h1>
          <p className="mt-1 text-sm text-muted-foreground">Passief inkomen en vermogensontwikkeling</p>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <KpiCard
            label="Passief inkomen dit jaar"
            value={formatCurrency(totalPassive.toNumber())}
            subtext={`Dividend, rente en huurinkomsten t/m ${todayStr}`}
          />
          <KpiCard
            label="Netto vermogen groei dit jaar"
            value={
              networthGrowth != null
                ? `${growthPositive ? '+' : ''}${formatCurrency(networthGrowth.toNumber())}`
                : '—'
            }
            subtext={networthGrowth != null ? `t.o.v. 1 jan ${currentYear}` : 'Onvoldoende historische data'}
            trend={networthGrowth != null ? { value: '', positive: growthPositive } : undefined}
          />
        </div>

        {/* Passief inkomen breakdown */}
        <PassiveIncomeBreakdown
          dividend={dividend}
          interest={interest}
          rentalNet={rentalNet}
        />

        {/* Nettovermogen tijdlijn */}
        {/* TODO: tweede lijn toevoegen als doelen-entiteit bestaat (Sprint 4) */}
        <NetWorthChart data={chartData} />

      </main>
    </>
  )
}
