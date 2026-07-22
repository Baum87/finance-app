import YahooFinance from 'yahoo-finance2'
import Decimal from 'decimal.js'

const yf = new YahooFinance()

export type PriceResult = {
  symbol: string
  price: Decimal
  currency: string
  fetchedAt: Date
}

export type HistoricalPrice = {
  date: Date
  close: Decimal
}

/**
 * Fetches the latest quote for a ticker symbol.
 * Throws if the price cannot be retrieved.
 */
export async function getLatestPrice(symbol: string): Promise<PriceResult> {
  const quote = await yf.quote(symbol)

  const price = quote.regularMarketPrice
  if (price == null || price <= 0) {
    throw new Error(`Geen geldige koers beschikbaar voor ${symbol}`)
  }

  return {
    symbol,
    price: new Decimal(price).toDecimalPlaces(4),
    currency: quote.currency ?? 'USD',
    fetchedAt: new Date(),
  }
}

// Yahoo Finance kan voor de laatste handelsdag(en) een nog niet afgewikkelde rij
// teruggeven (close/adjclose = null, overige velden wel gevuld). yahoo-finance2
// gooit dan een fout voor de HELE reeks — niet alleen voor die ene dag — waardoor
// jarenlange, verder prima data verloren gaat. Vraag daarom nooit de laatste
// paar dagen op; de live koers loopt toch via getLatestPrice.
const SETTLE_BUFFER_DAYS = 5

/**
 * Fetches historical daily close prices for a symbol between two dates.
 * Returns prices in ascending date order.
 */
export async function getHistoricalPrices(
  symbol: string,
  from: Date,
  to: Date,
): Promise<HistoricalPrice[]> {
  const safeToMs = Math.min(to.getTime(), Date.now() - SETTLE_BUFFER_DAYS * 24 * 60 * 60 * 1000)
  const period2 = safeToMs < from.getTime() ? from : new Date(safeToMs)

  const results = await yf.historical(symbol, {
    period1: from,
    period2,
    interval: '1d',
  })

  return results
    .filter(r => r.close != null)
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map(r => ({
      date: r.date,
      close: new Decimal(r.close!).toDecimalPlaces(4),
    }))
}

export type TickerSuggestion = { symbol: string; name: string; sector: string | null }

/**
 * Best-effort tickersuggestie voor xlsx-import: bronbestanden (bv. Degiro) leveren
 * een ISIN + productnaam maar geen ticker. Probeert eerst op ISIN te zoeken, dan op
 * productnaam. Geeft null bij geen match — de gebruiker bevestigt/corrigeert altijd
 * handmatig in het review-scherm, dit is puur voorinvulling, geen garantie.
 */
export async function suggestTicker(isin: string, productName: string): Promise<TickerSuggestion | null> {
  for (const query of [isin, productName]) {
    if (!query) continue
    try {
      const result = await yf.search(query, { quotesCount: 3 })
      const match = result.quotes.find(q => q.isYahooFinance && typeof q.symbol === 'string')
      if (match && match.isYahooFinance) {
        return {
          symbol: match.symbol,
          name: match.longname ?? match.shortname ?? productName,
          sector: match.sector ?? null,
        }
      }
    } catch {
      // Best-effort — probeer volgende query
    }
  }
  return null
}
