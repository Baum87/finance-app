import Decimal from 'decimal.js'

export type SimpleEntryRow = {
  broker: string
  invested: string
  currentValue: string
  entryDate: string // 'YYYY-MM-DD'
}

export type SimpleEntryMonthPoint = {
  month: string // 'YYYY-MM', voor labeldoeleinden door de caller om te zetten
  invested: Decimal
  currentValue: Decimal
}

function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7)
}

function addMonth(key: string): string {
  const [y, m] = key.split('-').map(Number)
  const total = y * 12 + (m - 1) + 1
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`
}

/**
 * Bouwt een maandelijkse reeks van ingelegd/huidige-waarde-totalen op basis
 * van de eenvoudige invoerlijsten (per broker de laatste rij t/m die maand,
 * bij elkaar opgeteld). Ontbrekende maanden per broker worden voortgezet
 * met de laatst bekende invoer (forward-fill), zodat elke maand een
 * betekenisvol totaal heeft, ook als niet elke broker die maand is bijgewerkt.
 */
export function buildSimpleEntryMonthlySeries(entries: SimpleEntryRow[], asOf: Date = new Date()): SimpleEntryMonthPoint[] {
  if (entries.length === 0) return []

  const byBroker = new Map<string, SimpleEntryRow[]>()
  for (const e of entries) {
    const list = byBroker.get(e.broker)
    if (list) list.push(e)
    else byBroker.set(e.broker, [e])
  }
  for (const list of byBroker.values()) list.sort((a, b) => a.entryDate.localeCompare(b.entryDate))

  const firstMonth = monthKey(entries.reduce((min, e) => (e.entryDate < min ? e.entryDate : min), entries[0].entryDate))
  const lastMonth = monthKey(asOf.toISOString().slice(0, 10))

  const months: string[] = []
  for (let key = firstMonth; key <= lastMonth; key = addMonth(key)) months.push(key)

  return months.map((month) => {
    const monthEnd = `${month}-31`
    let invested = new Decimal(0)
    let currentValue = new Decimal(0)

    for (const list of byBroker.values()) {
      let latest: SimpleEntryRow | null = null
      for (const e of list) {
        if (e.entryDate <= monthEnd) latest = e
        else break
      }
      if (latest) {
        invested = invested.plus(new Decimal(latest.invested))
        currentValue = currentValue.plus(new Decimal(latest.currentValue))
      }
    }

    return { month, invested, currentValue }
  })
}

export type SimpleEntryMonthPointWithPeriod = SimpleEntryMonthPoint & {
  /** Verandering in het cumulatieve ingelegde bedrag t.o.v. de vorige maand
   *  in de reeks — nieuwe inleg, geen rendement. Null voor de eerste maand
   *  (geen vorige maand om tegen af te zetten). */
  periodContribution: Decimal | null
  /** Waardeverandering t.o.v. de vorige maand, ná aftrek van `periodContribution`
   *  — het eigenlijke rendement die maand. Null voor de eerste maand. */
  periodGain: Decimal | null
}

/**
 * Verrijkt een maandelijkse ingelegd/huidige-waarde-reeks (buildSimpleEntryMonthlySeries)
 * met per maand het onderscheid tussen nieuwe inleg en eigenlijk rendement —
 * zonder dit onderscheid telt bijgestorte inleg in een maand ten onrechte mee
 * als winst die maand (zelfde principe als buildSimpleEntrySectionMetrics).
 */
export function withPeriodBreakdown(points: SimpleEntryMonthPoint[]): SimpleEntryMonthPointWithPeriod[] {
  return points.map((point, i) => {
    if (i === 0) return { ...point, periodContribution: null, periodGain: null }
    const prev = points[i - 1]
    const periodContribution = point.invested.minus(prev.invested)
    const periodGain = point.currentValue.minus(prev.currentValue).minus(periodContribution)
    return { ...point, periodContribution, periodGain }
  })
}

export type SingleValueRow = {
  group: string
  value: string
  entryDate: string // 'YYYY-MM-DD'
}

export type SingleValueMonthPoint = {
  month: string // 'YYYY-MM'
  value: Decimal
}

/**
 * Zelfde forward-fill-principe als buildSimpleEntryMonthlySeries, maar voor
 * categorieën met één bedrag per invoer (spaarrekening: saldo, vastgoed:
 * WOZ-waarde) i.p.v. een ingelegd/huidige-waarde-paar.
 */
export function buildSingleValueMonthlySeries(entries: SingleValueRow[], asOf: Date = new Date()): SingleValueMonthPoint[] {
  if (entries.length === 0) return []

  const byGroup = new Map<string, SingleValueRow[]>()
  for (const e of entries) {
    const list = byGroup.get(e.group)
    if (list) list.push(e)
    else byGroup.set(e.group, [e])
  }
  for (const list of byGroup.values()) list.sort((a, b) => a.entryDate.localeCompare(b.entryDate))

  const firstMonth = monthKey(entries.reduce((min, e) => (e.entryDate < min ? e.entryDate : min), entries[0].entryDate))
  const lastMonth = monthKey(asOf.toISOString().slice(0, 10))

  const months: string[] = []
  for (let key = firstMonth; key <= lastMonth; key = addMonth(key)) months.push(key)

  return months.map((month) => {
    const monthEnd = `${month}-31`
    let value = new Decimal(0)

    for (const list of byGroup.values()) {
      let latest: SingleValueRow | null = null
      for (const e of list) {
        if (e.entryDate <= monthEnd) latest = e
        else break
      }
      if (latest) value = value.plus(new Decimal(latest.value))
    }

    return { month, value }
  })
}
