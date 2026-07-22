import Decimal from 'decimal.js'

export type DatedCashflow = { amount: Decimal; date: Date }

export type AnnualReturnFigures = {
  returnAmount: Decimal
  returnPct: Decimal | null
}

const MS_PER_DAY = 1000 * 60 * 60 * 24

/**
 * Rendement voor één periode (kalenderjaar), via de Modified Dietz-methode.
 *
 * Waarom niet de simpele holding-period-formule (endValue − cashflow) / startValue?
 * Die behandelt élke cashflow alsof die aan het ÉÍND van de periode plaatsvond.
 * Bij een portefeuille met inleg verspreid over het jaar (bijv. bijna elke
 * maand een aankoop) overschat dat het rendement fors: geld dat pas in
 * november is ingelegd "verdient" dan alsnog het volledige jaarrendement over
 * de veel kleinere startwaarde. Modified Dietz weegt elke cashflow naar rato
 * van hoeveel van de periode er nog over was toen die plaatsvond — vroeg in
 * het jaar ingelegd geld telt zwaarder mee in de kapitaalbasis dan geld van
 * vlak voor het einde.
 *
 * cashflows: positief = inleg (buy/deposit/cost), negatief = onttrekking
 * (sell/withdrawal) — én dividend/interest/rental_income, want dat bedrag
 * zit niet in endValue (dat is puur qty × koers), dus moet het als
 * "onttrekking" meetellen om als rendement zichtbaar te worden. Zie
 * buildAnnualReturns (stock-series.ts) voor de opbouw — dezelfde
 * transactieclassificatie als XIRR (xirr-cashflows.ts), met omgekeerd teken.
 *
 * Bewust GEEN XIRR hier: XIRR annualiseert, en dat vertekent een kort of nog
 * lopend jaar sterk (zie STATUS.md R3 — "+3% YTD wordt zichtbaar als ~+14%").
 * Dit is dus ook geen "TWR voor benchmark-vergelijking" (CLAUDE.md regel 4) —
 * een apart, eigen gelabeld getal: het werkelijke rendement in dat kalenderjaar.
 *
 * returnPct is null als de tijdgewogen kapitaalbasis €0 of negatief is
 * (bijv. geen enkele relevante transactie in de periode).
 * returnAmount (het EUR-bedrag) is altijd beschikbaar en is timing-onafhankelijk.
 */
export function calculateAnnualReturn(
  startValue: Decimal,
  endValue: Decimal,
  periodStart: Date,
  periodEnd: Date,
  cashflows: DatedCashflow[],
): AnnualReturnFigures {
  const netCashflow = cashflows.reduce((s, cf) => s.plus(cf.amount), new Decimal(0))
  const returnAmount = endValue.minus(startValue).minus(netCashflow)

  let returnPct: Decimal | null = null
  const totalDays = (periodEnd.getTime() - periodStart.getTime()) / MS_PER_DAY

  if (totalDays > 0) {
    let weightedCashflow = new Decimal(0)
    for (const cf of cashflows) {
      const daysRemaining = (periodEnd.getTime() - cf.date.getTime()) / MS_PER_DAY
      const weight = Math.max(0, Math.min(1, daysRemaining / totalDays))
      weightedCashflow = weightedCashflow.plus(cf.amount.mul(weight))
    }
    const denominator = startValue.plus(weightedCashflow)
    if (denominator.gt(0)) {
      returnPct = returnAmount.div(denominator)
    }
  }

  return { returnAmount, returnPct }
}
