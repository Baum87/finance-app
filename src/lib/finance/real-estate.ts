import Decimal from 'decimal.js'

function assertPositive(value: Decimal, label: string): void {
  if (value.lte(0)) throw new Error(`${label} moet groter dan 0 zijn`)
}

/**
 * Gross rental yield: annual rental income / property value.
 * Returns decimal: 0.04 = 4%.
 */
export function calculateGrossRentalYield(
  annualRentalIncome: Decimal,
  propertyValue: Decimal,
): Decimal {
  assertPositive(propertyValue, 'Vastgoedwaarde')
  return annualRentalIncome.div(propertyValue).toDecimalPlaces(6)
}

/**
 * Net rental yield: (annual rental income - annual costs) / property value.
 */
export function calculateNetRentalYield(
  annualRentalIncome: Decimal,
  annualCosts: Decimal,
  propertyValue: Decimal,
): Decimal {
  assertPositive(propertyValue, 'Vastgoedwaarde')
  return annualRentalIncome.minus(annualCosts).div(propertyValue).toDecimalPlaces(6)
}

/**
 * Cash-on-cash return: annual net cashflow / initial investment (purchase price + costs).
 * Returns decimal: 0.15 = 15%.
 */
export function calculateCashOnCash(
  annualNetCashflow: Decimal,
  initialInvestment: Decimal,
): Decimal {
  assertPositive(initialInvestment, 'Initiële investering')
  return annualNetCashflow.div(initialInvestment).toDecimalPlaces(6)
}

/**
 * Loan-to-Value ratio: outstanding mortgage / property value.
 * Returns decimal: 0.74 = 74%.
 */
export function calculateLtv(
  outstandingMortgage: Decimal,
  propertyValue: Decimal,
): Decimal {
  assertPositive(propertyValue, 'Vastgoedwaarde')
  return outstandingMortgage.div(propertyValue).toDecimalPlaces(4)
}

/**
 * Equity in property: property value - outstanding mortgage.
 */
export function calculateEquity(
  propertyValue: Decimal,
  outstandingMortgage: Decimal,
): Decimal {
  return propertyValue.minus(outstandingMortgage).toDecimalPlaces(2)
}
