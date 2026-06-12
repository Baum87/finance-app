export { calculateXirr } from './xirr'
export type { Cashflow } from './xirr'
export { calculateCostBasis, calculateQuantityHeld } from './cost-basis'
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
export { calculateExcessReturn } from './benchmark'
export { buildNetWorthSeries } from './net-worth-series'
export type { NetWorthPoint } from './net-worth-series'
