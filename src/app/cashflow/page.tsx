import Decimal from 'decimal.js'
import { createServerSupabaseClient } from '@/lib/db/supabase-server'
import { getPassiveIncomeData, getNetWorthAtDate } from '@/lib/db/queries/cashflow'
import { getAssetsWithValues, getMortgageBalancesMap } from '@/lib/db/queries/assets'
import { calculateNetWorth } from '@/lib/finance'
import { formatCurrency } from '@/lib/utils/format'
import { Topbar } from '@/components/layout/Topbar'
import { KpiCard } from '@/components/ui/KpiCard'
import { PassiveIncomeBreakdown } from '@/components/cashflow/PassiveIncomeBreakdown'
import { NetWorthChart } from '@/components/vermogen/NetWorthChart'
import { db } from '@/lib/db'
import { assetValuations, assets, tenantUsers } from '@/lib/db/schema'
import { and, eq, asc } from 'drizzle-orm'
import { buildNetWorthSeries } from '@/lib/finance'

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

  const [txData, assets_, mortgageMap, networthJan1] = await Promise.all([
    getPassiveIncomeData(userId, ytdFrom, todayStr),
    getAssetsWithValues(userId),
    getMortgageBalancesMap(userId),
    getNetWorthAtDate(userId, ytdFrom),
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

  // Chart data uit valuations
  const tenantRows = await db
    .select({ tenantId: tenantUsers.tenantId })
    .from(tenantUsers)
    .where(and(eq(tenantUsers.userId, userId), eq(tenantUsers.role, 'owner')))
    .limit(1)

  const tenantId = tenantRows[0]?.tenantId ?? ''

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
      assetId:   v.assetId,
      date:      v.valuationDate,
      value:     new Decimal(v.value),
      liability: new Decimal(0),
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
