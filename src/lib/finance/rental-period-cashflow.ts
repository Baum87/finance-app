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
 * per maand) om naar een totaal over een periode, geproportioneerd op hele
 * kalendermaanden (huur wordt per maand betaald, niet per dag) — inclusief de
 * kalendermaand van `toDate`, ook als die nog niet volledig verstreken is
 * (zelfde vereenvoudiging als elders in dit bestand). Een periode zonder
 * endDate telt mee tot en met de maand van `toDate`.
 */
export function calculateRentalPeriodCashflowForRange(
  periods: RentalPeriodInput[],
  fromDate: Date | string,
  toDate: Date | string,
): RentalPeriodYearTotals {
  let income = new Decimal(0)
  let costs = new Decimal(0)

  const rangeStart = toMonthIndex(new Date(fromDate))
  const rangeEnd = toMonthIndex(new Date(toDate))

  for (const period of periods) {
    const amount = new Decimal(period.amount)
    if (amount.isNegative()) {
      throw new Error('Bedrag van een huur/kosten-periode mag niet negatief zijn')
    }

    const startDate = new Date(period.startDate)
    let contribution: Decimal

    if (period.frequency === 'once') {
      const eventMonth = toMonthIndex(startDate)
      contribution = eventMonth >= rangeStart && eventMonth <= rangeEnd ? amount : new Decimal(0)
    } else if (period.frequency === 'monthly') {
      const periodStart = toMonthIndex(startDate)
      const periodEnd = period.endDate ? toMonthIndex(new Date(period.endDate)) : rangeEnd
      const overlapStart = Math.max(periodStart, rangeStart)
      const overlapEnd = Math.min(periodEnd, rangeEnd)
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

/** Jaartotaal — dunne wrapper rond `calculateRentalPeriodCashflowForRange` voor 1 januari t/m 31 december. */
export function calculateRentalPeriodCashflowForYear(
  periods: RentalPeriodInput[],
  year: number,
): RentalPeriodYearTotals {
  return calculateRentalPeriodCashflowForRange(periods, new Date(year, 0, 1), new Date(year, 11, 31))
}
