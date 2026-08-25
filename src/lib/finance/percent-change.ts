import Decimal from 'decimal.js'

/**
 * Procentuele verandering van previous naar current, als decimaal (0.15 = +15%).
 * Geeft null terug als er geen vorige periode is om mee te vergelijken
 * (previous = 0) — dat is geen ongeldige invoer, maar een ontbrekende basis.
 */
export function calculatePercentChange(current: Decimal, previous: Decimal): Decimal | null {
  if (previous.isZero()) return null
  return current.minus(previous).dividedBy(previous)
}
