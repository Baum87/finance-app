import Decimal from 'decimal.js'

export type BufferLabel = 'krap' | 'gezond' | 'ruim'

/**
 * Hoeveel maanden vaste lasten het liquide spaargeld dekt. Geeft null terug
 * als er geen vaste lasten zijn om tegen af te zetten (monthlyExpenses = 0) —
 * dat is geen ongeldige invoer, maar een ontbrekende basis, zelfde patroon
 * als calculatePercentChange.
 */
export function calculateBufferMonths(liquidSavings: Decimal, monthlyExpenses: Decimal): Decimal | null {
  if (monthlyExpenses.isZero()) return null
  return liquidSavings.dividedBy(monthlyExpenses)
}

/**
 * Kwalitatieve duiding bij het aantal buffermaanden — vuistregel: minder dan
 * 3 maanden is krap, 3 tot 6 maanden is gezond, meer dan 6 maanden is ruim.
 * Een kaal getal zonder duiding laat de gebruiker zelf raden of het genoeg is.
 */
export function classifyBufferMonths(months: Decimal): BufferLabel {
  if (months.lt(3)) return 'krap'
  if (months.lte(6)) return 'gezond'
  return 'ruim'
}
