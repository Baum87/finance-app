import Decimal from 'decimal.js'
import { annualizeAmount } from './recurring-cashflow'
import type { RecurringFrequency, RecurringItemType } from './recurring-cashflow'

export type RecurringItemAmountPoint = { amount: string; effectiveDate: string }

export type RecurringItemHistoryInput = {
  itemType: RecurringItemType
  frequency: RecurringFrequency
  isShared: boolean
  amounts: RecurringItemAmountPoint[]
}

export type OneTimeExpenseInput = { amount: string; expenseDate: string; isShared: boolean }

export type MonthlyCashflowPoint = {
  month: string
  income: Decimal
  expenses: Decimal
  net: Decimal
}

/** Laatste `n` kalendermaanden t/m de maand van `asOf`, oudste eerst, als 'YYYY-MM'. */
export function lastNMonths(n: number, asOf: Date): string[] {
  const months: string[] = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(asOf.getFullYear(), asOf.getMonth() - i, 1)
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return months
}

/**
 * Reconstrueert inkomen/uitgaven per maand uit de bedraghistorie van vaste
 * lasten & inkomsten (`recurring_item_amounts`) plus eenmalige uitgaven. Voor
 * elke maand wordt per item het bedrag gebruikt dat toen gold (de meest
 * recente `effectiveDate` op of vóór die maand) — een item dat toen nog geen
 * bedrag had, telt voor die maand niet mee.
 *
 * Vereenvoudiging: gebruikt de huidige `isActive`-status van elk item (via
 * de meegegeven `items`-lijst) voor alle maanden — er is geen historie van
 * wanneer een item precies is geactiveerd/gedeactiveerd, zelfde aanpak als
 * `calculateRecurringTotals` elders in de app.
 */
export function buildMonthlyCashflowSeries(
  items: RecurringItemHistoryInput[],
  oneTimeExpenses: OneTimeExpenseInput[],
  months: string[],
): MonthlyCashflowPoint[] {
  const oneTimeByMonth = new Map<string, Decimal>()
  for (const expense of oneTimeExpenses) {
    const month = expense.expenseDate.slice(0, 7)
    const amount = new Decimal(expense.amount)
    const contribution = expense.isShared ? amount.dividedBy(2) : amount
    oneTimeByMonth.set(month, (oneTimeByMonth.get(month) ?? new Decimal(0)).plus(contribution))
  }

  return months.map(month => {
    let income = new Decimal(0)
    let expenses = oneTimeByMonth.get(month) ?? new Decimal(0)

    for (const item of items) {
      const applicable = item.amounts
        .filter(a => a.effectiveDate.slice(0, 7) <= month)
        .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate))[0]
      if (!applicable) continue

      let monthly = annualizeAmount(new Decimal(applicable.amount), item.frequency).dividedBy(12)
      if (item.isShared) monthly = monthly.dividedBy(2)

      if (item.itemType === 'income') income = income.plus(monthly)
      else if (item.itemType === 'expense') expenses = expenses.plus(monthly)
      else throw new Error(`Onbekend itemType: ${item.itemType}`)
    }

    return { month, income, expenses, net: income.minus(expenses) }
  })
}
