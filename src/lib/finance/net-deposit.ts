import Decimal from 'decimal.js'

type TxInput = { transactionType: string; amount: string; fees?: string | null }

/**
 * Net capital invested: buys + deposits minus sells and withdrawals.
 * Excludes dividends, interest, rental income, and costs.
 */
export function calculateNetDeposit(transactions: TxInput[]): Decimal {
  let total = new Decimal(0)
  for (const tx of transactions) {
    if (tx.transactionType === 'buy' || tx.transactionType === 'deposit') {
      total = total.plus(new Decimal(tx.amount)).plus(new Decimal(tx.fees ?? '0'))
    } else if (tx.transactionType === 'sell' || tx.transactionType === 'withdrawal') {
      total = total.minus(new Decimal(tx.amount))
    }
  }
  return total
}
