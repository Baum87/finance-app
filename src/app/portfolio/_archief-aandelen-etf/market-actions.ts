'use server'

import YahooFinance from 'yahoo-finance2'
import Decimal from 'decimal.js'
import { eq, and, ilike } from 'drizzle-orm'
import { db } from '@/lib/db'
import { assets, stockEtfDetails, brokers } from '@/lib/db/schema'
import { createServerSupabaseClient } from '@/lib/db/supabase-server'
import { getOrCreateTenant } from '@/lib/db/queries/tenant'
import { normalizePence } from '@/lib/services/prices'

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
  brokerName: string | null
}

export async function checkTickerExistsAction(ticker: string): Promise<ExistingPosition[]> {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []
    const tenantId = await getOrCreateTenant(user.id)
    const rows = await db
      .select({ id: assets.id, name: assets.name, brokerName: brokers.name })
      .from(assets)
      .innerJoin(stockEtfDetails, eq(stockEtfDetails.assetId, assets.id))
      .leftJoin(brokers, eq(brokers.id, stockEtfDetails.brokerId))
      .where(and(
        eq(assets.tenantId, tenantId),
        eq(assets.isActive, true),
        ilike(stockEtfDetails.ticker, ticker),
      ))
    return rows.map(r => ({ assetId: r.id, assetName: r.name, brokerName: r.brokerName ?? null }))
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

    // chart() i.p.v. historical(): geeft meta.currency mee, nodig om
    // pence-noteringen (GBp/GBX) te herkennen en te normaliseren naar GBP.
    const chart = await yf.chart(symbol, { period1: from, period2: to, interval: '1d' })
    const sorted = chart.quotes.filter(r => r.close != null).sort((a, b) => b.date.getTime() - a.date.getTime())
    if (!sorted.length) return null

    const { price, currency } = normalizePence(new Decimal(sorted[0].close!), chart.meta.currency)

    if (currency === 'EUR') return price.toNumber()

    const fxChart = await yf.chart(`${currency}EUR=X`, { period1: from, period2: to, interval: '1d' })
    const fxSorted = fxChart.quotes.filter(r => r.close != null).sort((a, b) => b.date.getTime() - a.date.getTime())
    const fxRate = fxSorted.length ? fxSorted[0].close! : 1

    return price.times(fxRate).toNumber()
  } catch {
    return null
  }
}

export async function getStockQuoteAction(symbol: string): Promise<StockQuote | null> {
  try {
    const quote = await yf.quote(symbol)
    // Pence-noteringen (GBp/GBX) normaliseren naar GBP vóór de FX-stap,
    // anders is de EUR-koers 100× te hoog (zie normalizePence in prices.ts).
    const normalized = normalizePence(new Decimal(quote.regularMarketPrice ?? 0), quote.currency ?? 'EUR')
    const nativeCurrency = normalized.currency
    const nativePrice = normalized.price.toNumber()

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
