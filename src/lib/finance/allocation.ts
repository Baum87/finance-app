import Decimal from 'decimal.js'

type AssetValue = { assetType: string; value: Decimal }

export type AllocationSlice = {
  assetType: string
  value: Decimal
  percentage: Decimal
}

/**
 * Portfolio allocation per asset type as percentage of total value.
 * Returns empty array if total is zero.
 */
export function calculateAllocation(assets: AssetValue[]): AllocationSlice[] {
  const total = assets.reduce((sum, a) => sum.plus(a.value), new Decimal(0))
  if (total.isZero()) return []

  // Aggregate by type
  const byType = new Map<string, Decimal>()
  for (const a of assets) {
    byType.set(a.assetType, (byType.get(a.assetType) ?? new Decimal(0)).plus(a.value))
  }

  return [...byType.entries()].map(([assetType, value]) => ({
    assetType,
    value: value.toDecimalPlaces(2),
    percentage: value.div(total).mul(100).toDecimalPlaces(2),
  }))
}
