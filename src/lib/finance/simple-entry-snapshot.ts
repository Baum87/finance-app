import Decimal from 'decimal.js'

export type SimpleEntrySnapshotRow = {
  broker: string
  invested: string
  currentValue: string
  entryDate: string // 'YYYY-MM-DD'
}

export type SimpleEntrySnapshot = {
  invested: Decimal
  currentValue: Decimal
}

/**
 * Som van ingelegd/huidige-waarde over de laatste rij per broker, op of vóór
 * `asOfDate` — een broker zonder invoer op of vóór die datum telt niet mee
 * (nog niet toegevoegd op dat moment). Onafhankelijk van invoervolgorde.
 */
export function sumSimpleEntriesAsOf(rows: SimpleEntrySnapshotRow[], asOfDate: string): SimpleEntrySnapshot {
  const latestPerBroker = new Map<string, SimpleEntrySnapshotRow>()
  for (const row of rows) {
    if (row.entryDate > asOfDate) continue
    const existing = latestPerBroker.get(row.broker)
    if (!existing || row.entryDate > existing.entryDate) latestPerBroker.set(row.broker, row)
  }

  let invested = new Decimal(0)
  let currentValue = new Decimal(0)
  for (const row of latestPerBroker.values()) {
    invested = invested.plus(new Decimal(row.invested))
    currentValue = currentValue.plus(new Decimal(row.currentValue))
  }
  return { invested, currentValue }
}

/**
 * De meest recente `entryDate` vóór de allerlaatste invoerdatum — dus: wanneer
 * je vóór je laatste update-sessie voor het laatst iets hebt bijgewerkt (over
 * alle brokers heen; meerdere brokers op dezelfde datum tellen als 1 sessie).
 * Geeft null als er geen eerdere invoerdatum is (nog maar 1 invoermoment).
 */
export function previousEntryDate(rows: SimpleEntrySnapshotRow[]): string | null {
  const dates = [...new Set(rows.map(r => r.entryDate))].sort()
  if (dates.length < 2) return null
  return dates[dates.length - 2]
}

export type PeriodBreakdown = {
  /** Verandering in het cumulatieve ingelegde bedrag over de periode — nieuwe
   *  inleg (of, bij een negatief getal, een onttrekking), geen rendement. */
  contribution: Decimal
  /** Waardeverandering ná aftrek van `contribution` — het eigenlijke
   *  rendement over de periode, losgekoppeld van nieuwe inleg. */
  gain: Decimal
  /** null als de startwaarde 0 is (geen zinvolle basis om tegen af te zetten). */
  gainPct: Decimal | null
}

export type SimpleEntrySectionMetrics = {
  invested: Decimal
  currentValue: Decimal
  gain: Decimal
  gainPct: Decimal | null
  /** null = onvoldoende data van vóór dit jaar om een YTD-vergelijking te maken. */
  ytd: PeriodBreakdown | null
  /** null = nog maar 1 invoermoment, geen vorige update om mee te vergelijken. */
  sinceLastUpdate: (PeriodBreakdown & { date: string }) | null
}

/**
 * Splitst de waardeverandering tussen twee momenten op in het deel dat door
 * nieuwe inleg komt (`contribution`, uit het verschil in het cumulatieve
 * ingelegde bedrag) en het deel dat overblijft als eigenlijk rendement
 * (`gain`) — zonder dit onderscheid telt bijgestorte inleg ten onrechte mee
 * als winst.
 */
function periodBreakdown(start: SimpleEntrySnapshot, current: SimpleEntrySnapshot): PeriodBreakdown {
  const contribution = current.invested.minus(start.invested)
  const gain = current.currentValue.minus(start.currentValue).minus(contribution)
  const gainPct = start.currentValue.gt(0) ? gain.dividedBy(start.currentValue) : null
  return { contribution, gain, gainPct }
}

/**
 * Gebundelde KPI's voor een categorie-sectie op basis van de eenvoudige
 * invoerlijst (ingelegd, huidige waarde, winst/verlies, en dezelfde
 * inleg/winst-uitsplitsing voor dit jaar en sinds de vorige invoer-update) —
 * herbruikt over meerdere categorieën (aandelen/ETF's, crypto, ...) die
 * dezelfde broker/ingelegd/huidige-waarde/datum-vorm delen.
 */
export function buildSimpleEntrySectionMetrics(
  rows: SimpleEntrySnapshotRow[],
  asOf: Date = new Date(),
): SimpleEntrySectionMetrics {
  const asOfStr = asOf.toISOString().slice(0, 10)
  const current = sumSimpleEntriesAsOf(rows, asOfStr)
  const gain = current.currentValue.minus(current.invested)
  const gainPct = current.invested.gt(0) ? gain.dividedBy(current.invested) : null

  const yearStart = `${asOf.getFullYear() - 1}-12-31`
  const hasDataBeforeThisYear = rows.some(r => r.entryDate <= yearStart)
  const ytd = hasDataBeforeThisYear
    ? periodBreakdown(sumSimpleEntriesAsOf(rows, yearStart), current)
    : null

  const prevEntryDate = previousEntryDate(rows)
  const sinceLastUpdate = prevEntryDate != null
    ? { date: prevEntryDate, ...periodBreakdown(sumSimpleEntriesAsOf(rows, prevEntryDate), current) }
    : null

  return {
    invested:     current.invested,
    currentValue: current.currentValue,
    gain, gainPct,
    ytd,
    sinceLastUpdate,
  }
}
