import Decimal from 'decimal.js'

/**
 * Samengestelde groei van een bedrag over een (evt. fractioneel) aantal jaren
 * tegen een vast jaarlijks rendement: currentValue × (1 + rate)^years.
 * Puur een projectie op basis van een aanname — geen XIRR/TWR (CLAUDE.md §4),
 * geen historisch feit.
 */
export function calculateProjectedValue(
  currentValue: Decimal,
  annualReturnRate: Decimal,
  years: Decimal,
): Decimal {
  if (years.lt(0)) {
    throw new Error('Aantal jaren mag niet negatief zijn')
  }
  if (annualReturnRate.lte(-1)) {
    throw new Error('Verwacht rendement kan niet -100% of lager zijn')
  }

  return currentValue.times(new Decimal(1).plus(annualReturnRate).pow(years))
}
