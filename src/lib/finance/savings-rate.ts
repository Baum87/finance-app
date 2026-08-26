import Decimal from 'decimal.js'

/**
 * Percentage van het netto maandinkomen dat overblijft, als decimaal (0.20 = 20%).
 * Geeft null terug als er geen inkomen is om een percentage tegen af te zetten
 * (monthlyIncome = 0) — dat is geen ongeldige invoer, maar een ontbrekende basis,
 * zelfde patroon als calculatePercentChange.
 */
export function calculateSavingsRate(netMonthlyCashflow: Decimal, monthlyIncome: Decimal): Decimal | null {
  if (monthlyIncome.isZero()) return null
  return netMonthlyCashflow.dividedBy(monthlyIncome)
}
