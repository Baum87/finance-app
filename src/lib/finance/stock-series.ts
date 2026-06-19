import Decimal from 'decimal.js'
import { getLatestPrice, getHistoricalPrices } from '@/lib/services/prices'
import type { PortfolioDataPoint } from './portfolio-series'
import type { DetailedTransaction } from '@/lib/db/queries/transactions'

export async function buildStockPortfolioSeries(
  txs: DetailedTransaction[],
  tickerByAssetId: Map<string, string>,
): Promise<PortfolioDataPoint[]> {
  if (txs.length === 0) return []

  const sorted = [...txs].sort((a, b) =>
    a.transactionDate.slice(0, 10).localeCompare(b.transactionDate.slice(0, 10)),
  )

  const firstDate = new Date(sorted[0].transactionDate.slice(0, 10))
  firstDate.setDate(1)
  const today = new Date()

  const months: string[] = []
  const cursor = new Date(firstDate)
  while (cursor <= today) {
    months.push(cursor.toISOString().slice(0, 7))
    cursor.setMonth(cursor.getMonth() + 1)
  }

  const uniqueTickers = [...new Set(tickerByAssetId.values())]

  const historicalByTicker = new Map<string, Map<string, number>>()
  const currencyByTicker = new Map<string, string>()

  await Promise.all(uniqueTickers.map(async ticker => {
    try {
      const [liveResult, historical] = await Promise.all([
        getLatestPrice(ticker),
        getHistoricalPrices(ticker, firstDate, today),
      ])
      currencyByTicker.set(ticker, liveResult.currency)
      const byMonth = new Map<string, number>()
      for (const p of historical) {
        byMonth.set(p.date.toISOString().slice(0, 7), p.close.toNumber())
      }
      historicalByTicker.set(ticker, byMonth)
    } catch { /* negeer mislukte tickers */ }
  }))

  const fxByBase = new Map<string, Map<string, number>>()
  const nonEur = [...new Set([...currencyByTicker.values()].filter(c => c !== 'EUR'))]
  await Promise.all(nonEur.map(async currency => {
    try {
      const fxHistory = await getHistoricalPrices(`${currency}EUR=X`, firstDate, today)
      const byMonth = new Map<string, number>()
      for (const p of fxHistory) {
        byMonth.set(p.date.toISOString().slice(0, 7), p.close.toNumber())
      }
      fxByBase.set(currency, byMonth)
    } catch {
      fxByBase.set(currency, new Map())
    }
  }))

  function lookupMonth(map: Map<string, number>, month: string): number | null {
    let m = month
    while (m >= months[0]) {
      if (map.has(m)) return map.get(m)!
      const [y, mo] = m.split('-').map(Number)
      m = mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, '0')}`
    }
    return null
  }

  function priceEurAt(ticker: string, month: string): number | null {
    const prices = historicalByTicker.get(ticker)
    if (!prices) return null
    const nativePrice = lookupMonth(prices, month)
    if (nativePrice === null) return null
    const currency = currencyByTicker.get(ticker) ?? 'EUR'
    if (currency === 'EUR') return nativePrice
    const fxMap = fxByBase.get(currency)
    const fxRate = fxMap ? lookupMonth(fxMap, month) : null
    if (fxRate === null) return null
    return nativePrice * fxRate
  }

  let cumInleg = new Decimal(0)
  const qtyHeld  = new Map<string, Decimal>()
  const costHeld = new Map<string, Decimal>()
  tickerByAssetId.forEach((_, id) => {
    qtyHeld.set(id, new Decimal(0))
    costHeld.set(id, new Decimal(0))
  })

  let txIdx = 0
  const result: PortfolioDataPoint[] = []

  for (const month of months) {
    const [my, mm] = month.split('-').map(Number)
    const monthEnd = new Date(my, mm, 0).toISOString().slice(0, 10)
    while (txIdx < sorted.length && sorted[txIdx].transactionDate.slice(0, 10) <= monthEnd) {
      const tx = sorted[txIdx]
      if (tx.transactionType === 'buy') {
        const cost = new Decimal(tx.amount).plus(new Decimal(tx.fees ?? '0'))
        cumInleg = cumInleg.plus(cost)
        if (tx.quantity) {
          qtyHeld.set(tx.assetId, (qtyHeld.get(tx.assetId) ?? new Decimal(0)).plus(new Decimal(tx.quantity)))
          costHeld.set(tx.assetId, (costHeld.get(tx.assetId) ?? new Decimal(0)).plus(cost))
        }
      } else if (tx.transactionType === 'sell') {
        if (tx.quantity) {
          const qty      = new Decimal(tx.quantity)
          const heldQty  = qtyHeld.get(tx.assetId) ?? new Decimal(0)
          const heldCost = costHeld.get(tx.assetId) ?? new Decimal(0)
          if (heldQty.gt(0)) {
            const soldCost = heldCost.div(heldQty).mul(qty)
            cumInleg = cumInleg.minus(soldCost)
            costHeld.set(tx.assetId, heldCost.minus(soldCost))
          }
          qtyHeld.set(tx.assetId, heldQty.minus(qty))
        }
      }
      txIdx++
    }

    if (cumInleg.lte(0)) continue

    let waarde = 0
    let waardeAvailable = true
    for (const [assetId, qty] of qtyHeld.entries()) {
      if (qty.lte(0)) continue
      const ticker = tickerByAssetId.get(assetId)
      if (!ticker) continue
      const priceEur = priceEurAt(ticker, month)
      if (priceEur === null) { waardeAvailable = false; continue }
      waarde += qty.toNumber() * priceEur
    }

    const [y, mo] = month.split('-').map(Number)
    const label = new Date(y, mo - 1).toLocaleDateString('nl-NL', { month: 'short', year: '2-digit' })
    result.push({ month: label, inleg: cumInleg.toNumber(), waarde: waardeAvailable ? waarde : undefined })
  }

  return result
}
