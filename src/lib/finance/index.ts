export { calculateXirr } from './xirr'
export type { Cashflow } from './xirr'
export { buildXirrCashflows, toXirrCashflow, hasMinimumXirrPeriod, XIRR_OUTFLOW_TYPES, XIRR_INFLOW_TYPES, XIRR_MIN_DAYS } from './xirr-cashflows'
export type { XirrTxInput } from './xirr-cashflows'
export { calculateCostBasis, calculateQuantityHeld, calculateRealizedGain } from './cost-basis'
export { calculateNetDeposit } from './net-deposit'
export { calculateMarketValue, calculateSavingsBalance, calculateUnrealizedGain } from './current-value'
export { calculatePassiveIncome } from './passive-income'
export { calculateAllocation } from './allocation'
export type { AllocationSlice } from './allocation'
export {
  calculateGrossRentalYield,
  calculateNetRentalYield,
  calculateCashOnCash,
  calculateLtv,
  calculateEquity,
} from './real-estate'
export { calculateNetWorth } from './net-worth'
export { calculateTwr } from './twr'
export type { TwrPeriod } from './twr'
export { calculateAnnualReturn } from './annual-return'
export type { AnnualReturnFigures } from './annual-return'
export { calculateExcessReturn } from './benchmark'
export { buildNetWorthSeries } from './net-worth-series'
export type { NetWorthPoint } from './net-worth-series'
export { buildSimpleEntryMonthlySeries, buildSingleValueMonthlySeries } from './simple-entry-series'
export type { SimpleEntryRow, SimpleEntryMonthPoint, SingleValueRow, SingleValueMonthPoint } from './simple-entry-series'
