import Decimal from 'decimal.js'

/**
 * Welk deel van de maandelijkse vaste lasten wordt gedekt door bruto passief
 * inkomen (dividend + rente + nettohuur, exclusief hypotheeklasten), als
 * decimaal (0.30 = 30%). Geeft null terug als er geen vaste lasten zijn om
 * tegen af te zetten (monthlyExpenses = 0) — dat is geen ongeldige invoer,
 * maar een ontbrekende basis, zelfde patroon als calculatePercentChange.
 */
export function calculatePassiveIncomeCoverage(monthlyPassiveIncome: Decimal, monthlyExpenses: Decimal): Decimal | null {
  if (monthlyExpenses.isZero()) return null
  return monthlyPassiveIncome.dividedBy(monthlyExpenses)
}
