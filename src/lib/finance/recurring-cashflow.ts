import Decimal from 'decimal.js'

export type RecurringFrequency = 'monthly' | 'four_weekly' | 'quarterly' | 'yearly'
export type RecurringItemType = 'income' | 'expense'

type RecurringItemInput = {
  itemType: RecurringItemType
  amount: string
  frequency: RecurringFrequency
  isActive: boolean
  isShared: boolean
}

export type RecurringCashflowTotals = {
  annualIncome: Decimal
  annualExpenses: Decimal
  netAnnualCashflow: Decimal
  monthlyIncome: Decimal
  monthlyExpenses: Decimal
  netMonthlyCashflow: Decimal
}

// 4-wekelijks (bijv. salaris): 13 periodes van 4 weken per jaar, de gangbare
// Nederlandse loonadministratie-conventie (13 × 4 = 52 weken).
const PERIODS_PER_YEAR: Record<RecurringFrequency, number> = {
  monthly:     12,
  four_weekly: 13,
  quarterly:   4,
  yearly:      1,
}

/**
 * Herleidt een bedrag met een gegeven frequentie naar een jaarbedrag.
 */
export function annualizeAmount(amount: Decimal, frequency: RecurringFrequency): Decimal {
  const periods = PERIODS_PER_YEAR[frequency]
  if (periods === undefined) {
    throw new Error(`Onbekende frequentie: ${frequency}`)
  }
  return amount.times(periods)
}

/**
 * Telt actieve vaste lasten en inkomsten op tot jaar- en maandtotalen.
 * Inactieve items tellen niet mee. Gezamenlijk betaalde posten (isShared) tellen
 * voor de helft mee — dat is het eigen aandeel in de gezamenlijke rekening.
 */
export function calculateRecurringTotals(items: RecurringItemInput[]): RecurringCashflowTotals {
  let annualIncome = new Decimal(0)
  let annualExpenses = new Decimal(0)

  for (const item of items) {
    if (!item.isActive) continue

    let annual = annualizeAmount(new Decimal(item.amount), item.frequency)
    if (item.isShared) annual = annual.dividedBy(2)

    if (item.itemType === 'income') {
      annualIncome = annualIncome.plus(annual)
    } else if (item.itemType === 'expense') {
      annualExpenses = annualExpenses.plus(annual)
    } else {
      throw new Error(`Onbekend itemType: ${item.itemType}`)
    }
  }

  const netAnnualCashflow = annualIncome.minus(annualExpenses)

  return {
    annualIncome,
    annualExpenses,
    netAnnualCashflow,
    monthlyIncome:      annualIncome.dividedBy(12),
    monthlyExpenses:    annualExpenses.dividedBy(12),
    netMonthlyCashflow: netAnnualCashflow.dividedBy(12),
  }
}
