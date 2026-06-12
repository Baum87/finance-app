import Decimal from 'decimal.js'

export type NetWorthPoint = {
  date: string
  netWorth: Decimal
}

type ValuationEntry = {
  assetId: string
  date: string
  value: Decimal
  liability: Decimal
}

/**
 * Builds a time series of net worth from a flat list of asset valuations.
 * For each unique date, sums (value - liability) across all assets.
 * Dates are ISO strings (YYYY-MM-DD), returned in ascending order.
 */
export function buildNetWorthSeries(valuations: ValuationEntry[]): NetWorthPoint[] {
  const byDate = new Map<string, Decimal>()

  for (const v of valuations) {
    const existing = byDate.get(v.date) ?? new Decimal(0)
    byDate.set(v.date, existing.plus(v.value).minus(v.liability))
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, netWorth]) => ({ date, netWorth: netWorth.toDecimalPlaces(2) }))
}
