import Decimal from 'decimal.js'

export type Cashflow = { amount: Decimal; date: Date }

/**
 * Calculates the Internal Rate of Return for irregular cashflows (XIRR).
 * Negative amounts = outflows (investments), positive = inflows (returns/sales).
 * Returns a decimal: 0.07 = 7%.
 */
export function calculateXirr(cashflows: Cashflow[]): Decimal {
  if (cashflows.length < 2) {
    throw new Error('XIRR vereist minimaal 2 cashflows')
  }

  const hasPositive = cashflows.some(cf => cf.amount.gt(0))
  const hasNegative = cashflows.some(cf => cf.amount.lt(0))
  if (!hasPositive || !hasNegative) {
    throw new Error('XIRR vereist zowel positieve als negatieve cashflows')
  }

  const sorted = [...cashflows].sort((a, b) => a.date.getTime() - b.date.getTime())
  const t0 = sorted[0].date.getTime()
  const MS_PER_YEAR = 1000 * 60 * 60 * 24 * 365.25
  const times = sorted.map(cf => (cf.date.getTime() - t0) / MS_PER_YEAR)
  const amounts = sorted.map(cf => cf.amount.toNumber())

  function npv(rate: number): number {
    return amounts.reduce((sum, cf, i) => sum + cf / Math.pow(1 + rate, times[i]), 0)
  }

  function dnpv(rate: number): number {
    return amounts.reduce(
      (sum, cf, i) => sum - (times[i] * cf) / Math.pow(1 + rate, times[i] + 1),
      0,
    )
  }

  const NPV_TOLERANCE = 1e-7
  const MAX_ITER = 100

  // Try multiple starting points to improve convergence
  for (const guess of [0.1, 0.0, -0.1, 0.5]) {
    let rate = guess
    for (let i = 0; i < MAX_ITER; i++) {
      const n = npv(rate)
      if (Math.abs(n) < NPV_TOLERANCE) {
        return new Decimal(rate).toDecimalPlaces(10)
      }
      const dn = dnpv(rate)
      if (Math.abs(dn) < 1e-15) break
      rate = rate - n / dn
    }
  }

  throw new Error('XIRR convergeert niet — controleer de cashflows')
}
