import Decimal from 'decimal.js'
import { getHistoricalPrices } from './prices'
import { calculateTwr } from '@/lib/finance'

const BENCHMARK_SYMBOL = 'URTH'

/**
 * Calculates the Time-Weighted Return for the URTH benchmark between two dates.
 * Returns null if data cannot be fetched or is insufficient.
 */
export async function getBenchmarkTwr(from: Date, to: Date): Promise<Decimal | null> {
  try {
    const prices = await getHistoricalPrices(BENCHMARK_SYMBOL, from, to)
    if (prices.length < 2) return null

    const periods = []
    for (let i = 1; i < prices.length; i++) {
      periods.push({
        startValue: prices[i - 1].close,
        endValue:   prices[i].close,
        cashflow:   new Decimal(0),
      })
    }

    return calculateTwr(periods)
  } catch {
    return null
  }
}
