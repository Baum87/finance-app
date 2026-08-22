import Decimal from 'decimal.js'
import { createServerSupabaseClient } from '@/lib/db/supabase-server'
import { getPassiveIncomeData, getNetWorthAtDate, getValuationTimeSeries, getMortgageBalanceTimeSeries } from '@/lib/db/queries/cashflow'
import { getAssetsWithValues, getMortgageBalancesMap } from '@/lib/db/queries/assets'
import { getRecurringItems } from '@/lib/db/queries/recurring-items'
import { calculateNetWorth, calculateRecurringTotals } from '@/lib/finance'
import { buildNetWorthSeries } from '@/lib/finance'
import { formatCurrency } from '@/lib/utils/format'
import { Topbar } from '@/components/layout/Topbar'
import { KpiCard } from '@/components/ui/KpiCard'
import { PassiveIncomeBreakdown } from '@/components/cashflow/PassiveIncomeBreakdown'
import { RecurringItemForm } from '@/components/cashflow/RecurringItemForm'
import { DeleteRecurringItemButton } from '@/components/cashflow/DeleteRecurringItemButton'
import { NetWorthChart } from '@/components/vermogen/NetWorthChart'
import { createRecurringItemAction, deleteRecurringItemAction } from './actions'

const ITEM_TYPE_LABELS: Record<string, string> = {
  income:  'Inkomen',
  expense: 'Uitgave',
}

const CATEGORY_LABELS: Record<string, string> = {
  salary:        'Salaris',
  insurance:     'Verzekering',
  subscription:  'Abonnement',
  mortgage:      'Hypotheek',
  municipal_tax: 'Gemeentelijke belasting',
  groceries:     'Boodschappen',
  other:         'Overig',
}

const FREQUENCY_LABELS: Record<string, string> = {
  monthly:   'Maandelijks',
  quarterly: 'Per kwartaal',
  yearly:    'Jaarlijks',
}

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

  const [txData, assets_, mortgageMap, networthJan1, valuationRows, mortgageBalanceRows, recurringItemRows] = await Promise.all([
    getPassiveIncomeData(userId, ytdFrom, todayStr),
    getAssetsWithValues(userId),
    getMortgageBalancesMap(userId),
    getNetWorthAtDate(userId, ytdFrom),
    getValuationTimeSeries(userId),
    getMortgageBalanceTimeSeries(userId),
    getRecurringItems(userId),
  ])

  const recurringTotals = calculateRecurringTotals(
    recurringItemRows.map(r => ({
      itemType:  r.itemType as 'income' | 'expense',
      amount:    r.amount,
      frequency: r.frequency as 'monthly' | 'quarterly' | 'yearly',
      isActive:  r.isActive,
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
        <div>
          <h2 className="text-lg font-semibold text-foreground">Vaste lasten & inkomsten</h2>
          <p className="mt-1 text-sm text-muted-foreground">Salaris, verzekeringen, abonnementen, hypotheek en overige vaste posten</p>
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
            trend={{ value: '', positive: recurringTotals.netMonthlyCashflow.gte(0) }}
          />
        </div>

        {recurringItemRows.length === 0 ? (
          <div className="bg-card border border-border rounded-3xl p-10 text-center">
            <p className="text-sm text-muted-foreground italic">Nog geen vaste lasten of inkomsten geregistreerd.</p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-3xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-6 py-3 text-muted-foreground font-medium">Naam</th>
                  <th className="text-left px-6 py-3 text-muted-foreground font-medium">Soort</th>
                  <th className="text-left px-6 py-3 text-muted-foreground font-medium">Categorie</th>
                  <th className="text-left px-6 py-3 text-muted-foreground font-medium">Frequentie</th>
                  <th className="text-right px-6 py-3 text-muted-foreground font-medium">Bedrag</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody>
                {recurringItemRows.map(item => (
                  <tr key={item.id} className="border-b border-border last:border-0">
                    <td className="px-6 py-3 font-medium text-foreground">{item.name}</td>
                    <td className="px-6 py-3 text-muted-foreground">{ITEM_TYPE_LABELS[item.itemType] ?? item.itemType}</td>
                    <td className="px-6 py-3 text-muted-foreground">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted">
                        {CATEGORY_LABELS[item.category] ?? item.category}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-muted-foreground">
                      {FREQUENCY_LABELS[item.frequency] ?? item.frequency}
                    </td>
                    <td className={`px-6 py-3 text-right font-medium ${item.itemType === 'income' ? 'text-sage' : 'text-foreground'}`}>
                      {item.itemType === 'income' ? '+' : '−'}{formatCurrency(new Decimal(item.amount).toNumber())}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <DeleteRecurringItemButton
                        itemId={item.id}
                        name={item.name}
                        action={deleteRecurringItemAction}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <RecurringItemForm action={createRecurringItemAction} />

      </main>
    </>
  )
}
