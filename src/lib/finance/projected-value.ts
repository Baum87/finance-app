import Decimal from 'decimal.js'

/**
 * Samengestelde groei van een bedrag over een (evt. fractioneel) aantal jaren
 * tegen een vast jaarlijks rendement: currentValue × (1 + rate)^years.
 * Puur een projectie op basis van een aanname — geen XIRR/TWR (CLAUDE.md §4),
 * geen historisch feit.
 */
export function calculateProjectedValue(
  currentValue: Decimal,
  annualReturnRate: Decimal,
  years: Decimal,
): Decimal {
  if (years.lt(0)) {
    throw new Error('Aantal jaren mag niet negatief zijn')
  }
  if (annualReturnRate.lte(-1)) {
    throw new Error('Verwacht rendement kan niet -100% of lager zijn')
  }

  return currentValue.times(new Decimal(1).plus(annualReturnRate).pow(years))
}

/**
 * Inverse van calculateProjectedValue: bij hoeveel jaar samengestelde groei
 * (rente op rente) tegen `annualReturnRate` bereikt `currentValue` de
 * `targetValue`? t = ln(target / current) / ln(1 + rate).
 *
 * Geeft null terug (geen fabricering van een getal) als er geen zinvol
 * antwoord is:
 * - currentValue ≤ 0 — geen basis om vanuit te groeien.
 * - annualReturnRate ≤ 0 — het doel wordt via rendement alleen nooit bereikt
 *   (bij exact 0% zou ln(1+rate) = 0 zijn, een deling door nul).
 */
export function calculateYearsToTarget(
  currentValue: Decimal,
  targetValue: Decimal,
  annualReturnRate: Decimal,
): Decimal | null {
  if (currentValue.lte(0)) return null
  if (targetValue.lte(currentValue)) return new Decimal(0)
  if (annualReturnRate.lte(0)) return null

  const ratio = targetValue.dividedBy(currentValue)
  const growthFactor = new Decimal(1).plus(annualReturnRate)
  return ratio.ln().dividedBy(growthFactor.ln())
}

export type GrowthComponent = { value: Decimal; annualReturnRate: Decimal }

const YEARS_TO_TARGET_MAX_ITERATIONS = 100
const YEARS_TO_TARGET_UPPER_BOUND_CAP_YEARS = 500

/**
 * Zoals calculateYearsToTarget, maar voor meerdere vermogensdelen die elk
 * tegen hun eigen rendement groeien (bijv. aandelen tegen 7%, vastgoed tegen
 * 4%), plus een vast overig deel dat niet meegroeit. Zonder dit onderscheid
 * zou je bijv. vastgoed ten onrechte tegen het aandelenrendement laten
 * meegroeien (of andersom).
 *
 * Er bestaat geen gesloten formule meer zodra er meer dan één groeivoet is
 * (de som van meerdere machtsfuncties is niet direct te inverteren), dus dit
 * lost `flatValue + Σ component.value × (1+rate)^t = targetValue` numeriek op
 * via bisectie — betrouwbaar omdat de linkerkant strikt stijgend is in `t`
 * zodra minstens één component een positief rendement en een positieve
 * waarde heeft (zelfde soort iteratieve aanpak als calculateXirr).
 *
 * Geeft null terug (geen fabricering van een getal) als het doel niet via
 * groei alleen bereikbaar is: geen enkele component heeft zowel een
 * positieve waarde als een positief rendement, of het doel ligt zelfs na
 * `YEARS_TO_TARGET_UPPER_BOUND_CAP_YEARS` nog niet binnen bereik.
 */
export function calculateYearsToTargetMulti(
  components: GrowthComponent[],
  flatValue: Decimal,
  targetValue: Decimal,
): Decimal | null {
  const totalAt = (t: Decimal) =>
    components.reduce(
      (sum, c) => sum.plus(c.value.times(new Decimal(1).plus(c.annualReturnRate).pow(t))),
      flatValue,
    )

  const currentTotal = totalAt(new Decimal(0))
  if (targetValue.lte(currentTotal)) return new Decimal(0)

  const canGrow = components.some(c => c.value.gt(0) && c.annualReturnRate.gt(0))
  if (!canGrow) return null

  let lo = new Decimal(0)
  let hi = new Decimal(1)
  while (totalAt(hi).lt(targetValue)) {
    hi = hi.times(2)
    if (hi.gt(YEARS_TO_TARGET_UPPER_BOUND_CAP_YEARS)) return null
  }

  for (let i = 0; i < YEARS_TO_TARGET_MAX_ITERATIONS; i++) {
    const mid = lo.plus(hi).dividedBy(2)
    if (totalAt(mid).gte(targetValue)) hi = mid
    else lo = mid
  }
  return hi
}
