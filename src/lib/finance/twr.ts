import Decimal from 'decimal.js'

export type TwrPeriod = {
  startValue: Decimal
  endValue: Decimal
  cashflow: Decimal
}

/**
 * Time-Weighted Return: links sub-period returns together.
 * Each period: HPR = (endValue - cashflow) / startValue.
 * TWR = product of (1 + HPR) for all periods - 1.
 * Throws if any period has startValue = 0.
 * Returns decimal: 0.12 = 12%.
 */
export function calculateTwr(periods: TwrPeriod[]): Decimal {
  if (periods.length === 0) return new Decimal(0)

  let product = new Decimal(1)
  for (const { startValue, endValue, cashflow } of periods) {
    // startValue = 0: geen rendement te berekenen voor deze sub-periode → neutraal (factor 1)
    if (startValue.isZero()) continue
    const growthFactor = endValue.minus(cashflow).div(startValue)
    product = product.mul(growthFactor)
  }
  return product.minus(1).toDecimalPlaces(6)
}
