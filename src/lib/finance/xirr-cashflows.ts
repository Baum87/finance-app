import Decimal from 'decimal.js'
import type { Cashflow } from './xirr'

export type XirrTxInput = { transactionType: string; amount: string; transactionDate: string }

// Welke transactietypes tellen mee in XIRR, en met welk teken.
// Bron van waarheid conform finance-logic.md §6 — elke aanroeper hergebruikt dit,
// nooit een eigen kopie van deze sets maken.
export const XIRR_OUTFLOW_TYPES = new Set(['buy', 'deposit', 'cost'])
export const XIRR_INFLOW_TYPES = new Set(['sell', 'withdrawal', 'dividend', 'interest', 'rental_income'])

/**
 * Cashflow uit één transactie voor XIRR, of null als het type niet meetelt.
 * amount is altijd in EUR (UI forceert currency=EUR, fxRate=1). Als Optie B
 * (vreemde valuta) ooit wordt ingevoerd: pas hier t.amount × t.fxRate toe.
 */
export function toXirrCashflow(tx: XirrTxInput): Cashflow | null {
  if (XIRR_OUTFLOW_TYPES.has(tx.transactionType)) {
    return { amount: new Decimal(tx.amount).negated(), date: new Date(tx.transactionDate) }
  }
  if (XIRR_INFLOW_TYPES.has(tx.transactionType)) {
    return { amount: new Decimal(tx.amount), date: new Date(tx.transactionDate) }
  }
  return null
}

/** Cashflows uit een lijst transacties voor XIRR (zie XIRR_OUTFLOW_TYPES/XIRR_INFLOW_TYPES). */
export function buildXirrCashflows(transactions: XirrTxInput[]): Cashflow[] {
  return transactions
    .map(toXirrCashflow)
    .filter((cf): cf is Cashflow => cf !== null)
}

const MS_PER_DAY = 1000 * 60 * 60 * 24
export const XIRR_MIN_DAYS = 30

/**
 * True als de vroegste cashflow minstens XIRR_MIN_DAYS terug ligt.
 * Voorkomt een misleidend sterk geannualiseerd getal over een te korte periode.
 */
export function hasMinimumXirrPeriod(cashflows: Cashflow[], asOf: Date = new Date()): boolean {
  if (cashflows.length === 0) return false
  const firstDate = cashflows.reduce(
    (min, cf) => (cf.date.getTime() < min.getTime() ? cf.date : min),
    cashflows[0].date,
  )
  return (asOf.getTime() - firstDate.getTime()) / MS_PER_DAY >= XIRR_MIN_DAYS
}
