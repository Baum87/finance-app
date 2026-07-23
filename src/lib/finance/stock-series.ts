import Decimal from 'decimal.js'
import { getLatestPrice, getHistoricalPrices } from '@/lib/services/prices'
import type { PortfolioDataPoint } from './portfolio-series'
import type { DetailedTransaction } from '@/lib/db/queries/transactions'
import { calculateAnnualReturn, type AnnualReturnFigures } from './annual-return'
import { buildXirrCashflows } from './xirr-cashflows'

// ─── Maand-aritmetiek zonder Date-object-mutatie ──────────────────────────────
// Date.setMonth()/getMonth() werken in lokale tijd, terwijl toISOString() UTC
// teruggeeft. Een cursor die je maandelijks ophoogt met setMonth() en labelt
// via toISOString() struikelt daardoor over de zomertijd-overgang (eind maart /
// eind oktober): de maand wordt dan een keer overgeslagen of dubbel geteld.
// Reken daarom uitsluitend met "YYYY-MM"-strings en hele getallen.

function monthKeyOf(dateStr: string): string {
  return dateStr.slice(0, 7)
}

function nextMonthKey(key: string): string {
  const [y, m] = key.split('-').map(Number)
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
}

function monthKeysBetween(fromKey: string, toKey: string): string[] {
  const keys: string[] = []
  let cursor = fromKey
  while (cursor <= toKey) {
    keys.push(cursor)
    cursor = nextMonthKey(cursor)
  }
  return keys
}

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

function isLeapYear(y: number): boolean {
  return y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)
}

/** Laatste kalenderdag van een "YYYY-MM"-maand, als "YYYY-MM-DD"-string. */
function lastDayOfMonth(key: string): string {
  const [y, m] = key.split('-').map(Number)
  const days = m === 2 && !isLeapYear(y) ? 28 : DAYS_IN_MONTH[m - 1]
  return `${key}-${String(days).padStart(2, '0')}`
}

function todayKeyLocal(today: Date): string {
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
}

/** "Vandaag" als "YYYY-MM-DD" in lokale tijd — nooit via toISOString(), dat geeft UTC. */
function todayDateKeyLocal(today: Date): string {
  return `${todayKeyLocal(today)}-${String(today.getDate()).padStart(2, '0')}`
}

// ─── Gedeelde infrastructuur: historische EUR-koersen per ticker, maandgranulariteit ──
// Gebruikt door zowel de maandelijkse portefeuillegrafiek als het jaarrendement-overzicht.

type PriceLookup = {
  priceEurAt: (ticker: string, month: string) => number | null
}

async function buildPriceLookup(
  tickerByAssetId: Map<string, string>,
  firstDate: Date,
  today: Date,
): Promise<PriceLookup> {
  const fromKey = monthKeyOf(firstDate.toISOString().slice(0, 10))
  const months = monthKeysBetween(fromKey, todayKeyLocal(today))

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

  return { priceEurAt }
}

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

  const months = monthKeysBetween(monthKeyOf(sorted[0].transactionDate.slice(0, 10)), todayKeyLocal(today))

  const { priceEurAt } = await buildPriceLookup(tickerByAssetId, firstDate, today)

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
    const monthEnd = lastDayOfMonth(month)
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

    // Som van alle posities waarvoor koersdata beschikbaar is. Een ontbrekende
    // koers voor 1 positie (bijv. een niet-herkende ticker) mag niet de hele
    // portefeuillewaarde laten verdwijnen — dan is de waarde een ondergrens
    // i.p.v. onbekend, consistent met de aanpak in buildAnnualReturns hieronder.
    let waarde = 0
    let heldCount = 0
    let missingCount = 0
    for (const [assetId, qty] of qtyHeld.entries()) {
      if (qty.lte(0)) continue
      heldCount++
      const ticker = tickerByAssetId.get(assetId)
      if (!ticker) { missingCount++; continue }
      const priceEur = priceEurAt(ticker, month)
      if (priceEur === null) { missingCount++; continue }
      waarde += qty.toNumber() * priceEur
    }
    const waardeAvailable = heldCount === 0 || missingCount < heldCount

    const [y, mo] = month.split('-').map(Number)
    const label = new Date(y, mo - 1).toLocaleDateString('nl-NL', { month: 'short', year: '2-digit' })
    result.push({
      month: label,
      inleg: cumInleg.toNumber(),
      waarde: waardeAvailable ? waarde : undefined,
      partial: waardeAvailable && missingCount > 0,
    })
  }

  return result
}

// ─── Rendement per kalenderjaar ────────────────────────────────────────────────

export type AnnualReturn = AnnualReturnFigures & {
  year: number
  startValue: Decimal
  endValue: Decimal
  /**
   * Netto externe cashflow tijdens dat jaar: buy/deposit/cost tellen als
   * inleg (+), sell/withdrawal/dividend/interest/rental_income als
   * onttrekking (-) — zelfde classificatie als XIRR (xirr-cashflows.ts).
   * Dividend telt hier bewust als "onttrekking": het dividendbedrag zit niet
   * in endValue (dat is qty × koers), dus moet het apart als rendement
   * meetellen — anders verdwijnt ontvangen dividend spoorloos uit het
   * jaarrendement.
   */
  netCashflow: Decimal
}

/**
 * Portefeuillewaarde en rendement per kalenderjaar, van het jaar van de eerste
 * transactie t/m nu. Zie calculateAnnualReturn voor de methodologie (bewust
 * niet-geannualiseerd, geen XIRR — zie STATUS.md R3).
 */
export async function buildAnnualReturns(
  txs: DetailedTransaction[],
  tickerByAssetId: Map<string, string>,
): Promise<AnnualReturn[]> {
  if (txs.length === 0) return []

  const sorted = [...txs].sort((a, b) =>
    a.transactionDate.slice(0, 10).localeCompare(b.transactionDate.slice(0, 10)),
  )

  const firstDate = new Date(sorted[0].transactionDate.slice(0, 10))
  firstDate.setDate(1)
  const today = new Date()

  const { priceEurAt } = await buildPriceLookup(tickerByAssetId, firstDate, today)

  const fromYear = firstDate.getFullYear()
  const toYear = today.getFullYear()

  const qtyHeld = new Map<string, Decimal>()
  tickerByAssetId.forEach((_, id) => qtyHeld.set(id, new Decimal(0)))

  let txIdx = 0
  // Waarde per ultimo jaar Y (of "nu" voor het lopende jaar). fromYear-1 = 0:
  // vóór de eerste transactie was er nog geen portefeuille.
  const yearEndValues = new Map<number, Decimal>()
  yearEndValues.set(fromYear - 1, new Decimal(0))

  for (let year = fromYear; year <= toYear; year++) {
    const isCurrentYear = year === toYear
    const boundaryDate = isCurrentYear ? todayDateKeyLocal(today) : `${year}-12-31`
    const monthKey     = isCurrentYear ? todayKeyLocal(today) : `${year}-12`

    while (txIdx < sorted.length && sorted[txIdx].transactionDate.slice(0, 10) <= boundaryDate) {
      const tx = sorted[txIdx]
      if (tx.quantity) {
        if (tx.transactionType === 'buy') {
          qtyHeld.set(tx.assetId, (qtyHeld.get(tx.assetId) ?? new Decimal(0)).plus(new Decimal(tx.quantity)))
        } else if (tx.transactionType === 'sell') {
          qtyHeld.set(tx.assetId, (qtyHeld.get(tx.assetId) ?? new Decimal(0)).minus(new Decimal(tx.quantity)))
        }
      }
      txIdx++
    }

    let waarde = new Decimal(0)
    for (const [assetId, qty] of qtyHeld.entries()) {
      if (qty.lte(0)) continue
      const ticker = tickerByAssetId.get(assetId)
      if (!ticker) continue
      const priceEur = priceEurAt(ticker, monthKey)
      if (priceEur === null) continue
      waarde = waarde.plus(qty.mul(priceEur))
    }
    yearEndValues.set(year, waarde)
  }

  const results: AnnualReturn[] = []
  for (let year = fromYear; year <= toYear; year++) {
    const startValue = yearEndValues.get(year - 1) ?? new Decimal(0)
    const endValue = yearEndValues.get(year)!
    const yearTxs = sorted.filter(t => t.transactionDate.slice(0, 4) === String(year))
    // Gedateerde cashflows i.p.v. één jaartotaal — Modified Dietz (zie
    // calculateAnnualReturn) heeft de datum per cashflow nodig om vroeg-in-het-
    // jaar-ingelegd geld zwaarder te wegen dan geld van vlak voor het einde.
    // Negatie van de XIRR-cashflows: XIRR ziet buy/deposit/cost als uitstroom (-)
    // en sell/withdrawal/dividend/interest/rental_income als instroom (+); hier
    // willen we het omgekeerde teken (inleg is positief).
    const cashflows = buildXirrCashflows(yearTxs).map(cf => ({ amount: cf.amount.negated(), date: cf.date }))
    const netCashflow = cashflows.reduce((s, cf) => s.plus(cf.amount), new Decimal(0))

    const periodStart = new Date(year, 0, 1)
    const periodEnd = year === toYear ? today : new Date(year, 11, 31)
    const { returnAmount, returnPct } = calculateAnnualReturn(startValue, endValue, periodStart, periodEnd, cashflows)

    results.push({ year, startValue, endValue, netCashflow, returnAmount, returnPct })
  }

  return results
}
