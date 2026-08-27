import Decimal from 'decimal.js'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/db/supabase-server'
import { getPassiveIncomeData } from '@/lib/db/queries/cashflow'
import { getRecurringItems, getRecurringItemsWithHistory } from '@/lib/db/queries/recurring-items'
import { getOneTimeExpenses } from '@/lib/db/queries/one-time-expenses'
import { getSavingsEntries, latestPerGroup } from '@/lib/db/queries/simple-entries'
import {
  calculateRecurringTotals, calculateOneTimeExpensesTotal,
  calculateSavingsRate, calculateBufferMonths, classifyBufferMonths, calculatePassiveIncomeCoverage,
  buildMonthlyCashflowSeries, lastNMonths,
} from '@/lib/finance'
import { formatCurrency, formatPercent } from '@/lib/utils/format'
import { Topbar } from '@/components/layout/Topbar'
import { KpiCard } from '@/components/ui/KpiCard'
import { PassiveIncomeBreakdown } from '@/components/cashflow/PassiveIncomeBreakdown'
import { MonthlyCashflowChart } from '@/components/cashflow/MonthlyCashflowChart'

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

  const [txData, recurringItemRows, recurringItemHistoryRows, oneTimeExpenseRows, savingsEntries] = await Promise.all([
    getPassiveIncomeData(userId, ytdFrom, todayStr),
    getRecurringItems(userId),
    getRecurringItemsWithHistory(userId),
    getOneTimeExpenses(userId),
    getSavingsEntries(userId),
  ])

  // Eenvoudige invoerlijsten (o.a. spaarrekeningen) hebben geen "asset"-entiteit
  // en zijn newest-first, dus de laatste rij per groep vóór een datum is de
  // waarde op dat moment.
  function sumLatestPerGroupAsOf<T extends { entryDate: string }>(
    rows: T[],
    keyFn: (r: T) => string,
    valueFn: (r: T) => string,
    asOfDate: string,
  ): Decimal {
    const latest = latestPerGroup(rows.filter(r => r.entryDate <= asOfDate), keyFn)
    return latest.reduce((s, r) => s.plus(new Decimal(valueFn(r))), new Decimal(0))
  }

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
  const netCashflowInclOneTime = recurringTotals.netAnnualCashflow.minus(oneTimeExpensesThisYear)

  // Cashflow-trend — laatste 12 maanden, reconstrueert per maand welk bedrag
  // toen gold uit de bedraghistorie (zie buildMonthlyCashflowSeries).
  const monthlyCashflowSeries = buildMonthlyCashflowSeries(
    recurringItemHistoryRows.map(r => ({
      itemType:  r.itemType as 'income' | 'expense',
      frequency: r.frequency as 'monthly' | 'four_weekly' | 'quarterly' | 'yearly',
      isShared:  r.isShared,
      amounts:   r.amounts,
    })),
    oneTimeExpenseRows.map(e => ({ amount: e.amount, expenseDate: e.expenseDate, isShared: e.isShared })),
    lastNMonths(12, today),
  ).map(p => ({ month: p.month, income: p.income.toNumber(), expenses: p.expenses.toNumber(), net: p.net.toNumber() }))

  // Passief inkomen YTD
  const dividend  = txData.filter(t => t.transactionType === 'dividend').reduce((s, t) => s.plus(t.amount), new Decimal(0))
  const interest  = txData.filter(t => t.transactionType === 'interest').reduce((s, t) => s.plus(t.amount), new Decimal(0))
  const rentalIn  = txData.filter(t => t.transactionType === 'rental_income').reduce((s, t) => s.plus(t.amount), new Decimal(0))
  const costs     = txData.filter(t => t.transactionType === 'cost').reduce((s, t) => s.plus(t.amount), new Decimal(0))
  const rentalNet = rentalIn.minus(costs)
  const totalPassive = dividend.plus(interest).plus(rentalNet)

  // Financiële gezondheid — spaarquote, buffer-dekking, dekkingsgraad passief inkomen
  const liquidSavingsToday = sumLatestPerGroupAsOf(savingsEntries, e => e.bank, e => e.balance, todayStr)

  const savingsRate = calculateSavingsRate(recurringTotals.netMonthlyCashflow, recurringTotals.monthlyIncome)

  const bufferMonths = calculateBufferMonths(liquidSavingsToday, recurringTotals.monthlyExpenses)
  const bufferLabel = bufferMonths != null ? classifyBufferMonths(bufferMonths) : null
  const bufferLabelText: Record<'krap' | 'gezond' | 'ruim', string> = { krap: 'Krap', gezond: 'Gezond', ruim: 'Ruim' }

  // Passief inkomen is een YTD-totaal — pas herleiden naar een maandgemiddelde
  // zodra er minstens 1 maand aan data is, anders vertekent een paar dagen
  // begin januari de dekkingsgraad enorm (zelfde voorzichtigheid als bij XIRR
  // over korte periodes, zie financial-expert.md §2a).
  const msPerDay = 24 * 60 * 60 * 1000
  const daysElapsedYtd = Math.floor((today.getTime() - new Date(ytdFrom).getTime()) / msPerDay) + 1
  const monthsElapsedYtd = daysElapsedYtd / (365 / 12)
  const monthlyPassiveIncome = monthsElapsedYtd >= 1 ? totalPassive.dividedBy(monthsElapsedYtd) : null
  const passiveIncomeCoverage = monthlyPassiveIncome != null
    ? calculatePassiveIncomeCoverage(monthlyPassiveIncome, recurringTotals.monthlyExpenses)
    : null

  return (
    <>
      <Topbar />
      <main className="mx-auto max-w-[1200px] px-8 py-12 space-y-6">

        <div>
          <h1 className="text-2xl font-semibold text-foreground">Cashflow</h1>
          <p className="mt-1 text-sm text-muted-foreground">Overzicht van inkomen, uitgaven en de gezondheid van je cashflow</p>
        </div>

        {/* Financiële gezondheid */}
        <div>
          <h2 className="text-lg font-semibold text-foreground">Financiële gezondheid</h2>
          <p className="mt-1 text-sm text-muted-foreground">Hou je genoeg over, en kun je een tegenslag opvangen?</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <KpiCard
            label="Spaarquote"
            value={savingsRate != null ? formatPercent(savingsRate.toNumber()) : '—'}
            subtext={savingsRate != null ? 'Vuistregel: streef naar 20% of meer' : 'Nog geen inkomen geregistreerd'}
            trend={savingsRate != null ? {
              value:    savingsRate.gte(0) ? 'Overschot' : 'Tekort',
              positive: savingsRate.gte(0),
            } : undefined}
          />
          <KpiCard
            label="Buffer-dekking"
            value={bufferMonths != null ? `${bufferMonths.toDecimalPlaces(1).toString()} mnd` : '—'}
            subtext={bufferMonths != null
              ? `${formatCurrency(liquidSavingsToday.toNumber())} liquide spaargeld / vaste lasten per maand`
              : 'Geen vaste lasten geregistreerd om tegen af te zetten'}
            trend={bufferLabel != null ? {
              value:    bufferLabelText[bufferLabel],
              positive: bufferLabel !== 'krap',
            } : undefined}
          />
          <KpiCard
            label="Dekkingsgraad passief inkomen"
            value={passiveIncomeCoverage != null ? formatPercent(passiveIncomeCoverage.toNumber()) : '—'}
            subtext={passiveIncomeCoverage != null
              ? 'Deel van je vaste lasten gedekt door bruto passief inkomen'
              : 'Onvoldoende data dit jaar (nog geen volledige maand, of geen vaste lasten)'}
          />
        </div>

        {/* Bruto passief inkomen */}
        <KpiCard
          label="Bruto passief inkomen dit jaar"
          value={txData.length === 0 ? '—' : formatCurrency(totalPassive.toNumber())}
          subtext={txData.length === 0
            ? 'Nog geen inkomsten geregistreerd dit jaar'
            : `Dividend, rente en huurinkomsten t/m ${todayStr} — excl. hypotheeklasten`}
        />

        {/* Passief inkomen breakdown */}
        <PassiveIncomeBreakdown
          dividend={dividend}
          interest={interest}
          rentalNet={rentalNet}
        />

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

        {/* Cashflow-trend */}
        <MonthlyCashflowChart data={monthlyCashflowSeries} />

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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <KpiCard
            label="Eenmalige uitgaven dit jaar"
            value={formatCurrency(oneTimeExpensesThisYear.toNumber())}
            subtext={`t/m ${todayStr} — telt niet mee in de maandelijkse cashflow hierboven`}
          />
          <KpiCard
            label="Cashflow dit jaar incl. eenmalige uitgaven"
            value={`${netCashflowInclOneTime.gte(0) ? '+' : ''}${formatCurrency(netCashflowInclOneTime.toNumber())}`}
            subtext={`${formatCurrency(recurringTotals.netAnnualCashflow.toNumber())} netto cashflow − ${formatCurrency(oneTimeExpensesThisYear.toNumber())} eenmalige uitgaven = ${formatCurrency(netCashflowInclOneTime.toNumber())}`}
            trend={{
              value:    netCashflowInclOneTime.gte(0) ? 'Overschot' : 'Tekort',
              positive: netCashflowInclOneTime.gte(0),
            }}
          />
        </div>

      </main>
    </>
  )
}
