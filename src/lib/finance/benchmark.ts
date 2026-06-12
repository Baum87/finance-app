import Decimal from 'decimal.js'

/**
 * Excess return (alpha): portfolio return minus benchmark return.
 * Both inputs are decimals where 0.07 = 7%.
 * Returns decimal.
 */
export function calculateExcessReturn(
  portfolioReturn: Decimal,
  benchmarkReturn: Decimal,
): Decimal {
  return portfolioReturn.minus(benchmarkReturn).toDecimalPlaces(6)
}
