import Decimal from 'decimal.js'
import { getHistoricalPrices } from './prices'
import { calculateTwr } from '@/lib/finance'

// IWDA.AS = iShares Core MSCI World UCITS ETF, EUR-genoteerd op Euronext Amsterdam.
// Gekozen boven URTH (USD) omdat EUR-beleggers anders het EUR/USD-koerseffect zien
// als benchmark-rendement, wat een systematisch vertekend beeld geeft.
const BENCHMARK_SYMBOL = 'IWDA.AS'

/**
 * Koersrendement van de benchmark per kalenderjaar, van het jaar van `from`
 * t/m het jaar van `to`. Voor het eerste jaar wordt gerekend vanaf `from`
 * (de start van de portefeuille) i.p.v. 1 januari — anders vergelijk je een
 * deeljaar-portefeuille met een volledig benchmarkjaar. Voor het lopende
 * jaar t/m `to`. Puur koersrendement (geen cashflows), EUR-genoteerd, dus
 * direct naast het Modified Dietz-portefeuillerendement te leggen — met de
 * kanttekening dat de benchmark tijdgewogen is en de portefeuille
 * inleg-gewogen.
 * Jaren zonder bruikbare data ontbreken in de map.
 */
export async function getBenchmarkAnnualReturns(from: Date, to: Date): Promise<Map<number, Decimal>> {
  const result = new Map<number, Decimal>()
  try {
    // 14 dagen vóór `from` beginnen zodat er een slotkoers ligt vóór de eerste jaargrens.
    const fetchFrom = new Date(from.getTime() - 14 * 24 * 60 * 60 * 1000)
    const prices = await getHistoricalPrices(BENCHMARK_SYMBOL, fetchFrom, to)
    if (prices.length < 2) return result

    const lastCloseOnOrBefore = (boundary: Date): Decimal | null => {
      let found: Decimal | null = null
      for (const p of prices) {
        if (p.date.getTime() > boundary.getTime()) break
        found = p.close
      }
      return found
    }

    for (let year = from.getFullYear(); year <= to.getFullYear(); year++) {
      const startBoundary = year === from.getFullYear() ? from : new Date(year - 1, 11, 31)
      const endBoundary = year === to.getFullYear() ? to : new Date(year, 11, 31)
      const start = lastCloseOnOrBefore(startBoundary)
      const end = lastCloseOnOrBefore(endBoundary)
      // Referentie-check: zelfde datapunt betekent geen handelsdata in dit jaar.
      if (start === null || end === null || start.lte(0) || start === end) continue
      result.set(year, end.div(start).minus(1).toDecimalPlaces(6))
    }
  } catch {
    // Benchmark is een nice-to-have — nooit de pagina laten falen.
  }
  return result
}

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
