import Decimal from 'decimal.js'

export type GoalType = 'savings' | 'net_worth' | 'passive_income_coverage'

export type GoalProgressInput = {
  goalType: GoalType
  /** Verplicht voor 'savings'/'net_worth', genegeerd voor 'passive_income_coverage'
   *  (dat doel streeft altijd naar 100% dekkingsgraad — geen apart bedrag). */
  targetAmount: Decimal | null
  /** Huidige spaargeld / netto vermogen / dekkingsgraad (als 0-1 decimaal).
   *  Null = onvoldoende data om te bepalen (geen NaN/0 fabriceren). */
  currentValue: Decimal | null
}

export type GoalProgress = {
  currentValue: Decimal
  targetValue: Decimal
  percentage: Decimal
}

/**
 * Voortgang van het actieve doel (startpagina) — bedrag/dekkingsgraad tegen
 * target, als decimaal (0.42 = 42%, kan boven 1 uitkomen als het doel al
 * gehaald is). Geeft null terug bij ontbrekende data, gooit een Error bij
 * een ongeldig doelbedrag (nooit stilletjes 0/NaN).
 */
export function calculateGoalProgress(input: GoalProgressInput): GoalProgress | null {
  if (input.currentValue === null) return null

  if (input.goalType === 'passive_income_coverage') {
    const targetValue = new Decimal(1)
    return { currentValue: input.currentValue, targetValue, percentage: input.currentValue.dividedBy(targetValue) }
  }

  if (input.goalType !== 'savings' && input.goalType !== 'net_worth') {
    throw new Error(`Onbekend doeltype: ${input.goalType}`)
  }
  if (input.targetAmount === null || input.targetAmount.lte(0)) {
    throw new Error('Doelbedrag is verplicht en moet groter dan 0 zijn voor dit doeltype')
  }

  return {
    currentValue: input.currentValue,
    targetValue:  input.targetAmount,
    percentage:   input.currentValue.dividedBy(input.targetAmount),
  }
}
