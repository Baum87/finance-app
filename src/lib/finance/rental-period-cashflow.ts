import Decimal from 'decimal.js'

export type RentalPeriodFrequency = 'monthly' | 'once'
export type RentalPeriodCashflowType = 'rental_income' | 'cost'

export type RentalPeriodInput = {
  cashflowType: RentalPeriodCashflowType
  amount: Decimal | string
  frequency: RentalPeriodFrequency
  startDate: Date | string
  endDate: Date | string | null
}

export type RentalPeriodYearTotals = {
  income: Decimal
  costs: Decimal
}

function toMonthIndex(d: Date): number {
  return d.getFullYear() * 12 + d.getMonth()
}

/**
 * Rekent doorlopende huur/kosten-periodes (vanaf-datum, evt. tot-datum, bedrag
 * per maand) om naar een jaartotaal, geproportioneerd op hele kalendermaanden
 * (huur wordt per maand betaald, niet per dag). Een periode zonder endDate telt
 * mee tot en met december van het gevraagde jaar.
 */
export function calculateRentalPeriodCashflowForYear(
  periods: RentalPeriodInput[],
  year: number,
): RentalPeriodYearTotals {
  let income = new Decimal(0)
  let costs = new Decimal(0)

  const yearStart = toMonthIndex(new Date(year, 0, 1))
  const yearEnd = toMonthIndex(new Date(year, 11, 1))

  for (const period of periods) {
    const amount = new Decimal(period.amount)
    if (amount.isNegative()) {
      throw new Error('Bedrag van een huur/kosten-periode mag niet negatief zijn')
    }

    const startDate = new Date(period.startDate)
    let contribution: Decimal

    if (period.frequency === 'once') {
      contribution = startDate.getFullYear() === year ? amount : new Decimal(0)
    } else if (period.frequency === 'monthly') {
      const periodStart = toMonthIndex(startDate)
      const periodEnd = period.endDate ? toMonthIndex(new Date(period.endDate)) : yearEnd
      const overlapStart = Math.max(periodStart, yearStart)
      const overlapEnd = Math.min(periodEnd, yearEnd)
      const months = Math.max(0, overlapEnd - overlapStart + 1)
      contribution = amount.times(months)
    } else {
      throw new Error(`Onbekende frequentie: ${period.frequency}`)
    }

    if (period.cashflowType === 'rental_income') income = income.plus(contribution)
    else if (period.cashflowType === 'cost') costs = costs.plus(contribution)
    else throw new Error(`Onbekend cashflowType: ${period.cashflowType}`)
  }

  return { income, costs }
}
