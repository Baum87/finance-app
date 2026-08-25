import Decimal from 'decimal.js'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/db/supabase-server'
import { getPassiveIncomeData, getNetWorthAtDate, getValuationTimeSeries, getMortgageBalanceTimeSeries } from '@/lib/db/queries/cashflow'
import { getAssetsWithValues, getMortgageBalancesMap } from '@/lib/db/queries/assets'
import { getRecurringItems } from '@/lib/db/queries/recurring-items'
import { getOneTimeExpenses } from '@/lib/db/queries/one-time-expenses'
import { getLiabilities } from '@/lib/db/queries/liabilities'
import { calculateNetWorth, calculateRecurringTotals, calculateOneTimeExpensesTotal } from '@/lib/finance'
import { buildNetWorthSeries } from '@/lib/finance'
import { formatCurrency } from '@/lib/utils/format'
import { Topbar } from '@/components/layout/Topbar'
import { KpiCard } from '@/components/ui/KpiCard'
import { PassiveIncomeBreakdown } from '@/components/cashflow/PassiveIncomeBreakdown'
import { NetWorthChart } from '@/components/vermogen/NetWorthChart'

function toDateStr(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export default async function CashflowOverviewPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user!.id

  const today = new Date()
  const currentYear = today.getFullYear()
  const ytdFrom = `${currentYear}-01-01`
  const todayStr = toDateStr(today)

  const [txData, assets_, mortgageMap, networthJan1, valuationRows, mortgageBalanceRows, recurringItemRows, oneTimeExpenseRows, liabilities] = await Promise.all([
    getPassiveIncomeData(userId, ytdFrom, todayStr),
    getAssetsWithValues(userId),
    getMortgageBalancesMap(userId),
    getNetWorthAtDate(userId, ytdFrom),
    getValuationTimeSeries(userId),
    getMortgageBalanceTimeSeries(userId),
    getRecurringItems(userId),
    getOneTimeExpenses(userId),
    getLiabilities(userId),
  ])

  // liabilities heeft geen historische bedrag-tracking (in tegenstelling tot
  // mortgage_balances) — alleen huidige, actieve schulden. Voor de Jan1-vergelijking
  // nemen we aan dat een schuld al meetelde als startDate vóór 1 jan ligt (of
  // onbekend is); zo telt een lening die dit jaar is afgesloten pas mee vanaf het
  // moment dat hij ontstond, en vertekent een al langer bestaande schuld de groei niet.
  const totalLiabilitiesToday = liabilities.reduce((s, l) => s.plus(l.amount), new Decimal(0))
  const totalLiabilitiesJan1 = liabilities
    .filter(l => !l.startDate || l.startDate <= ytdFrom)
    .reduce((s, l) => s.plus(l.amount), new Decimal(0))

  const oneTimeExpensesThisYear = calculateOneTimeExpensesTotal(
    oneTimeExpenseRows.filter(e => e.expenseDate.slice(0, 4) === String(currentYear)),
  )

  const recurringTotals = calculateRecurringTotals(
    recurringItemRows.map(r => ({
      itemType:  r.itemType as 'income' | 'expense',
      amount:    r.amount,
      frequency: r.frequency as 'monthly' | 'four_weekly' | 'quarterly' | 'yearly',
      isActive:  r.isActive,
      isShared:  r.isShared,
    })),
  )

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
  ).minus(totalLiabilitiesToday)

  const networthGrowth = networthJan1 != null
    ? networthToday.minus(networthJan1.minus(totalLiabilitiesJan1))
    : null
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
          <p className="mt-1 text-sm text-muted-foreground">Overzicht van passief inkomen, vaste lasten en vermogensontwikkeling</p>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <KpiCard
            label="Passief inkomen dit jaar"
            value={txData.length === 0 ? '—' : formatCurrency(totalPassive.toNumber())}
            subtext={txData.length === 0
              ? 'Nog geen inkomsten geregistreerd dit jaar'
              : `Dividend, rente en huurinkomsten t/m ${todayStr} — excl. hypotheeklasten`}
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

        {/* Vaste lasten & inkomsten */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Vaste lasten & inkomsten</h2>
            <p className="mt-1 text-sm text-muted-foreground">Salaris, verzekeringen, abonnementen, hypotheek en overige vaste posten</p>
          </div>
          <Link href="/cashflow/vaste-lasten" className="text-sm font-medium text-sage hover:opacity-70 transition-opacity whitespace-nowrap">
            Beheren →
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <KpiCard
            label="Inkomen per maand"
            value={formatCurrency(recurringTotals.monthlyIncome.toNumber())}
            subtext={`${formatCurrency(recurringTotals.annualIncome.toNumber())} per jaar`}
          />
          <KpiCard
            label="Vaste lasten per maand"
            value={formatCurrency(recurringTotals.monthlyExpenses.toNumber())}
            subtext={`${formatCurrency(recurringTotals.annualExpenses.toNumber())} per jaar`}
          />
          <KpiCard
            label="Netto cashflow per maand"
            value={`${recurringTotals.netMonthlyCashflow.gte(0) ? '+' : ''}${formatCurrency(recurringTotals.netMonthlyCashflow.toNumber())}`}
            subtext={`${formatCurrency(recurringTotals.netAnnualCashflow.toNumber())} per jaar`}
            trend={{
              value:    recurringTotals.netMonthlyCashflow.gte(0) ? 'Overschot' : 'Tekort',
              positive: recurringTotals.netMonthlyCashflow.gte(0),
            }}
          />
        </div>

        {/* Eenmalige uitgaven */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Eenmalige uitgaven</h2>
            <p className="mt-1 text-sm text-muted-foreground">Losstaande grote aankopen, geen doorlopende post</p>
          </div>
          <Link href="/cashflow/eenmalige-uitgaven" className="text-sm font-medium text-sage hover:opacity-70 transition-opacity whitespace-nowrap">
            Beheren →
          </Link>
        </div>

        <KpiCard
          label="Eenmalige uitgaven dit jaar"
          value={formatCurrency(oneTimeExpensesThisYear.toNumber())}
          subtext={`t/m ${todayStr} — telt niet mee in de maandelijkse cashflow hierboven`}
        />

      </main>
    </>
  )
}
