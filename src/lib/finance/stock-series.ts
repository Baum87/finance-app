import Decimal from 'decimal.js'
import { getLatestPrice, getHistoricalPrices } from '@/lib/services/prices'
import type { PortfolioDataPoint } from './portfolio-series'
import type { DetailedTransaction } from '@/lib/db/queries/transactions'
import { calculateAnnualReturn, type AnnualReturnFigures } from './annual-return'
import { buildXirrCashflows } from './xirr-cashflows'
import { calculateTwr } from './twr'

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

// ─── Maandelijkse waarde-reeks: bron van waarheid voor zowel de portefeuille-
// grafiek als het jaarrendement, zodat ze nooit uit elkaar kunnen lopen ──────

type MonthlySnapshot = {
  month: string
  /** Cumulatieve netto inleg t/m einde van deze maand. */
  inleg: Decimal
  /** Portefeuillewaarde einde van deze maand (kostprijs als koers ontbreekt). */
  waarde: Decimal
  partial: boolean
}

async function buildMonthlySnapshots(
  txs: DetailedTransaction[],
  tickerByAssetId: Map<string, string>,
): Promise<MonthlySnapshot[]> {
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
  const result: MonthlySnapshot[] = []

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

    // Som van alle posities. Ontbreekt de marktkoers (bv. een niet-beursgenoteerd
    // certificaat), val dan terug op de kostprijs (AVCO) i.p.v. de positie als €0
    // te tellen — anders telt de inleg wél mee maar de waarde niet, wat een vals
    // koersverlies suggereert zodra zo'n positie een groot deel van de portefeuille
    // uitmaakt (bijv. vroeg in de reeks, met weinig andere posities).
    let waarde = new Decimal(0)
    let missingCount = 0
    for (const [assetId, qty] of qtyHeld.entries()) {
      if (qty.lte(0)) continue
      const ticker = tickerByAssetId.get(assetId)
      const priceEur = ticker ? priceEurAt(ticker, month) : null
      if (priceEur !== null) {
        waarde = waarde.plus(qty.mul(priceEur))
        continue
      }
      missingCount++
      const cost = costHeld.get(assetId)
      if (cost) waarde = waarde.plus(cost)
    }

    result.push({ month, inleg: cumInleg, waarde, partial: missingCount > 0 })
  }

  return result
}

export async function buildStockPortfolioSeries(
  txs: DetailedTransaction[],
  tickerByAssetId: Map<string, string>,
): Promise<PortfolioDataPoint[]> {
  const snapshots = await buildMonthlySnapshots(txs, tickerByAssetId)

  return snapshots.map(s => {
    const [y, mo] = s.month.split('-').map(Number)
    const label = new Date(y, mo - 1).toLocaleDateString('nl-NL', { month: 'short', year: '2-digit' })
    return {
      month: label,
      inleg: s.inleg.toNumber(),
      waarde: s.waarde.toNumber(),
      partial: s.partial,
    }
  })
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
 * transactie t/m nu.
 *
 * returnAmount (€) blijft eenvoudig endValue − startValue − netCashflow —
 * timing-onafhankelijk, altijd betrouwbaar.
 *
 * returnPct wordt berekend via maandelijkse Time-Weighted Return-koppeling
 * (calculateTwr), NIET via Modified Dietz. Reden: Modified Dietz deelt door
 * een tijdgewogen kapitaalbasis die in een jong jaar (kleine basis) of bij
 * pieken-in-de-inleg (bv. veel aankopen vlak vóór jaareinde) extreem dun kan
 * worden — een normale koersbeweging in de teller geeft dan een percentage
 * van honderden procenten dat niets over het werkelijke rendement zegt.
 * TWR koppelt elke maand z'n éígen groeifactor t.o.v. zíjn éígen beginwaarde,
 * dus is ongevoelig voor wannéér de inleg binnenkwam. Dat maakt dit cijfer
 * bovendien vergelijkbaar met de benchmark (die ook TWR is, zie benchmark.ts)
 * — dit is dus bewust GEEN XIRR (dat blijft elders het primaire, geld-gewogen
 * rendementsgetal, CLAUDE.md regel 4) en ook geen Modified Dietz meer.
 */
export async function buildAnnualReturns(
  txs: DetailedTransaction[],
  tickerByAssetId: Map<string, string>,
): Promise<AnnualReturn[]> {
  if (txs.length === 0) return []

  const snapshots = await buildMonthlySnapshots(txs, tickerByAssetId)
  if (snapshots.length === 0) return []

  const sorted = [...txs].sort((a, b) =>
    a.transactionDate.slice(0, 10).localeCompare(b.transactionDate.slice(0, 10)),
  )

  const fromYear = Number(snapshots[0].month.slice(0, 4))
  const today = new Date()
  const toYear = today.getFullYear()

  // Waarde per ultimo jaar Y (of "nu" voor het lopende jaar) = waarde van de
  // laatste snapshot in dat jaar. fromYear-1 = 0: vóór de eerste transactie
  // was er nog geen portefeuille.
  const yearEndValues = new Map<number, Decimal>()
  yearEndValues.set(fromYear - 1, new Decimal(0))
  for (let year = fromYear; year <= toYear; year++) {
    const monthsInYear = snapshots.filter(s => s.month.startsWith(`${year}-`))
    const last = monthsInYear[monthsInYear.length - 1]
    yearEndValues.set(year, last ? last.waarde : (yearEndValues.get(year - 1) ?? new Decimal(0)))
  }

  // TWR-subperiodes per jaar, in 1 doorgang over de volledige, chronologisch
  // gesorteerde maandreeks. Elke maand met een positieve beginwaarde levert 1
  // subperiode op; de allereerste maand ooit (beginwaarde €0) kan er geen
  // leveren — TWR is dan pas vanaf de tweede actieve maand te berekenen, net
  // als bij elke performance-tool.
  const periodsByYear = new Map<number, { startValue: Decimal; endValue: Decimal; cashflow: Decimal }[]>()
  let prevWaarde = new Decimal(0)
  let prevInleg = new Decimal(0)
  for (const snap of snapshots) {
    const year = Number(snap.month.slice(0, 4))
    if (prevWaarde.gt(0)) {
      const list = periodsByYear.get(year) ?? []
      list.push({ startValue: prevWaarde, endValue: snap.waarde, cashflow: snap.inleg.minus(prevInleg) })
      periodsByYear.set(year, list)
    }
    prevWaarde = snap.waarde
    prevInleg = snap.inleg
  }

  const results: AnnualReturn[] = []
  for (let year = fromYear; year <= toYear; year++) {
    const startValue = yearEndValues.get(year - 1) ?? new Decimal(0)
    const endValue = yearEndValues.get(year)!
    const yearTxs = sorted.filter(t => t.transactionDate.slice(0, 4) === String(year))
    const cashflows = buildXirrCashflows(yearTxs).map(cf => ({ amount: cf.amount.negated(), date: cf.date }))
    const netCashflow = cashflows.reduce((s, cf) => s.plus(cf.amount), new Decimal(0))

    const periodStart = new Date(year, 0, 1)
    const periodEnd = year === toYear ? today : new Date(year, 11, 31)
    // returnAmount uit calculateAnnualReturn hergebruiken (simpele, timing-
    // onafhankelijke formule) — returnPct van die functie (Modified Dietz)
    // wordt bewust genegeerd, zie TWR-toelichting hierboven.
    const { returnAmount } = calculateAnnualReturn(startValue, endValue, periodStart, periodEnd, cashflows)

    const periods = periodsByYear.get(year) ?? []
    const returnPct = periods.length > 0 ? calculateTwr(periods) : null

    results.push({ year, startValue, endValue, netCashflow, returnAmount, returnPct })
  }

  return results
}
