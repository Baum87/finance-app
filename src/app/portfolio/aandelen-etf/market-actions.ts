'use server'

import YahooFinance from 'yahoo-finance2'
import { eq, and, ilike } from 'drizzle-orm'
import { db } from '@/lib/db'
import { assets, stockEtfDetails } from '@/lib/db/schema'
import { createServerSupabaseClient } from '@/lib/db/supabase-server'
import { getOrCreateTenant } from '@/lib/db/queries/tenant'

const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] })

export type StockSearchResult = {
  symbol: string
  name: string
  exchange: string
  type: string
}

export async function searchStocksAction(query: string): Promise<StockSearchResult[]> {
  if (query.length < 2) return []
  try {
    const result = await yf.search(query, { quotesCount: 8, newsCount: 0 })
    return ((result.quotes ?? []) as any[])
      .filter(q => ['EQUITY', 'ETF', 'MUTUALFUND'].includes(q.quoteType))
      .map(q => ({
        symbol: q.symbol as string,
        name: (q.shortname ?? q.longname ?? q.symbol) as string,
        exchange: (q.exchDisp ?? q.exchange ?? '') as string,
        type: (q.quoteType ?? '') as string,
      }))
  } catch {
    return []
  }
}

export type StockQuote = {
  priceEur: number
  priceNative: number
  nativeCurrency: string
  name: string
  sector: string | null
  instrumentType: string
}

export type ExistingPosition = {
  assetId: string
  assetName: string
  broker: string | null
}

export async function checkTickerExistsAction(ticker: string): Promise<ExistingPosition[]> {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []
    const tenantId = await getOrCreateTenant(user.id)
    const rows = await db
      .select({ id: assets.id, name: assets.name, broker: stockEtfDetails.broker })
      .from(assets)
      .innerJoin(stockEtfDetails, eq(stockEtfDetails.assetId, assets.id))
      .where(and(
        eq(assets.tenantId, tenantId),
        eq(assets.isActive, true),
        ilike(stockEtfDetails.ticker, ticker),
      ))
    return rows.map(r => ({ assetId: r.id, assetName: r.name, broker: r.broker }))
  } catch {
    return []
  }
}

export async function getHistoricalPriceEurAction(symbol: string, date: string): Promise<number | null> {
  try {
    const from = new Date(date)
    from.setDate(from.getDate() - 5)
    const to = new Date(date)
    to.setDate(to.getDate() + 1)

    const [history, liveQuote] = await Promise.all([
      yf.historical(symbol, { period1: from, period2: to, interval: '1d' }),
      yf.quote(symbol),
    ])

    const sorted = history.filter(r => r.close != null).sort((a, b) => b.date.getTime() - a.date.getTime())
    if (!sorted.length) return null

    const nativePrice = sorted[0].close!
    const currency = liveQuote.currency ?? 'EUR'

    if (currency === 'EUR') return nativePrice

    const fxHistory = await yf.historical(`${currency}EUR=X`, { period1: from, period2: to, interval: '1d' })
    const fxSorted = fxHistory.filter(r => r.close != null).sort((a, b) => b.date.getTime() - a.date.getTime())
    const fxRate = fxSorted.length ? fxSorted[0].close! : 1

    return nativePrice * fxRate
  } catch {
    return null
  }
}

export async function getStockQuoteAction(symbol: string): Promise<StockQuote | null> {
  try {
    const quote = await yf.quote(symbol)
    const nativeCurrency = quote.currency ?? 'EUR'
    const nativePrice = quote.regularMarketPrice ?? 0

    let priceEur = nativePrice

    if (nativeCurrency !== 'EUR') {
      try {
        const fx = await yf.quote(`${nativeCurrency}EUR=X`)
        const rate = fx.regularMarketPrice ?? 1
        priceEur = nativePrice * rate
      } catch {
        // FX niet beschikbaar — native prijs gebruiken
      }
    }

    // Sector ophalen via quoteSummary (alleen voor aandelen, niet ETF)
    let sector: string | null = null
    const quoteType = (quote as any).quoteType ?? 'EQUITY'
    if (quoteType === 'EQUITY') {
      try {
        const summary = await yf.quoteSummary(symbol, { modules: ['summaryProfile'] })
        sector = (summary.summaryProfile as any)?.sector ?? null
      } catch { /* sector niet beschikbaar */ }
    }

    const instrumentType = quoteType === 'ETF' ? 'etf'
      : quoteType === 'MUTUALFUND' ? 'fund'
      : 'stock'

    return {
      priceEur,
      priceNative: nativePrice,
      nativeCurrency,
      name: quote.shortName ?? quote.longName ?? symbol,
      sector,
      instrumentType,
    }
  } catch {
    return null
  }
}
