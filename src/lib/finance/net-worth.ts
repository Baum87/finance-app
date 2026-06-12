import Decimal from 'decimal.js'

type AssetEntry = { value: Decimal; liability: Decimal }

/**
 * Net worth: sum of (asset value - liability) across all assets.
 */
export function calculateNetWorth(assets: AssetEntry[]): Decimal {
  return assets
    .reduce((sum, a) => sum.plus(a.value).minus(a.liability), new Decimal(0))
    .toDecimalPlaces(2)
}
