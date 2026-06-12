import Decimal from 'decimal.js'
import { calculateQuantityHeld } from './cost-basis'

type TxInput = {
  transactionType: string
  amount: string
  quantity?: string | null
}

/**
 * Current value for stock_etf or crypto: quantity held × current price.
 */
export function calculateMarketValue(
  transactions: TxInput[],
  currentPrice: Decimal,
): Decimal {
  if (currentPrice.lte(0)) throw new Error('Koers moet groter dan 0 zijn')
  const qty = calculateQuantityHeld(transactions)
  return qty.mul(currentPrice).toDecimalPlaces(2)
}

/**
 * Net balance for savings accounts: sum of deposits minus withdrawals.
 */
export function calculateSavingsBalance(transactions: TxInput[]): Decimal {
  let balance = new Decimal(0)
  for (const tx of transactions) {
    if (tx.transactionType === 'deposit') {
      balance = balance.plus(new Decimal(tx.amount))
    } else if (tx.transactionType === 'withdrawal') {
      balance = balance.minus(new Decimal(tx.amount))
    }
  }
  return balance.toDecimalPlaces(2)
}

/**
 * Unrealized gain/loss: currentValue minus netDeposit.
 */
export function calculateUnrealizedGain(
  currentValue: Decimal,
  netDeposit: Decimal,
): Decimal {
  return currentValue.minus(netDeposit)
}
