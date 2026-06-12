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
  if (periods.length === 0) throw new Error('Minimaal één periode vereist voor TWR')

  let product = new Decimal(1)
  for (const { startValue, endValue, cashflow } of periods) {
    if (startValue.isZero()) throw new Error('Startwaarde mag niet nul zijn in TWR periode')
    // growthFactor = (endValue - cashflow) / startValue — already a factor like 1.10, not a percentage
    const growthFactor = endValue.minus(cashflow).div(startValue)
    product = product.mul(growthFactor)
  }
  return product.minus(1).toDecimalPlaces(6)
}
