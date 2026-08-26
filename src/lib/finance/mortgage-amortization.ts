import Decimal from 'decimal.js'

export type MortgageType = 'annuity' | 'linear' | 'interest_only'

export type MortgageTerms = {
  type: MortgageType
  /** Oorspronkelijk geleend bedrag. */
  originalAmount: Decimal
  /** Jaarrente als decimaal (0.035 = 3,5%), niet als percentage. */
  annualInterestRate: Decimal
  startDate: Date
  /** Totale looptijd in maanden. */
  termMonths: number
}

export type AmortizationYearResult = {
  interestPaid: Decimal
  principalRepaid: Decimal
}

function assertValidTerms(terms: MortgageTerms): void {
  if (terms.originalAmount.lte(0)) throw new Error('Oorspronkelijk hypotheekbedrag moet groter dan 0 zijn')
  if (terms.annualInterestRate.lt(0)) throw new Error('Hypotheekrente kan niet negatief zijn')
  if (!Number.isInteger(terms.termMonths) || terms.termMonths <= 0) {
    throw new Error('Looptijd moet een positief aantal maanden zijn')
  }
}

/**
 * Splitst de jaarlijkse hypotheeklasten in rente en aflossing voor een
 * gegeven kalenderjaar, puur op basis van de contractuele voorwaarden
 * (rente, hypotheekvorm, oorspronkelijk bedrag, looptijd) — geen
 * saldo-historie nodig. Simuleert de aflossing maand voor maand vanaf
 * `startDate`.
 *
 * Aanname: het contractuele schema wordt exact gevolgd, zonder extra
 * (vervroegde) aflossingen. Bij extra aflossingen wijkt de werkelijke
 * rente/aflossing-verdeling af van deze berekening — dat hoort als
 * disclaimer bij de weergave, niet als correctie in deze functie.
 *
 * Een jaar volledig vóór de startdatum of ná volledige afbetaling geeft
 * geen fout, maar €0 rente en €0 aflossing — dat is een geldig antwoord
 * ("geen hypotheekactiviteit dat jaar"), geen ontbrekende data.
 */
export function calculateMortgageAmortizationForYear(
  terms: MortgageTerms,
  year: number,
): AmortizationYearResult {
  assertValidTerms(terms)

  const { type, originalAmount, annualInterestRate, startDate, termMonths } = terms
  const monthlyRate = annualInterestRate.dividedBy(12)

  let monthlyPayment: Decimal | null = null
  if (type === 'annuity') {
    if (monthlyRate.isZero()) {
      monthlyPayment = originalAmount.dividedBy(termMonths)
    } else {
      const growth = new Decimal(1).plus(monthlyRate).pow(termMonths)
      monthlyPayment = originalAmount.times(monthlyRate).times(growth).dividedBy(growth.minus(1))
    }
  }
  const linearPrincipal = type === 'linear' ? originalAmount.dividedBy(termMonths) : null

  let balance = originalAmount
  let interestPaid = new Decimal(0)
  let principalRepaid = new Decimal(0)

  for (let m = 0; m < termMonths; m++) {
    const monthDate = new Date(startDate.getFullYear(), startDate.getMonth() + m, 1)
    const monthInterest = balance.times(monthlyRate)
    const monthPrincipal =
      type === 'interest_only' ? new Decimal(0)
      : type === 'linear'      ? linearPrincipal!
      : monthlyPayment!.minus(monthInterest)

    if (monthDate.getFullYear() === year) {
      interestPaid = interestPaid.plus(monthInterest)
      principalRepaid = principalRepaid.plus(monthPrincipal)
    }

    balance = balance.minus(monthPrincipal)
    if (balance.lt(0)) balance = new Decimal(0)
  }

  return {
    interestPaid: interestPaid.toDecimalPlaces(2),
    principalRepaid: principalRepaid.toDecimalPlaces(2),
  }
}
