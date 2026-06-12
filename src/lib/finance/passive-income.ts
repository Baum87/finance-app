import Decimal from 'decimal.js'

type TxInput = {
  transactionType: string
  amount: string
  transactionDate: string
}

/**
 * Total passive income in a period: dividend + interest + rental_income minus costs.
 * fromDate/toDate are ISO date strings (YYYY-MM-DD). If omitted, all transactions.
 */
export function calculatePassiveIncome(
  transactions: TxInput[],
  fromDate?: string,
  toDate?: string,
): Decimal {
  let total = new Decimal(0)

  for (const tx of transactions) {
    if (fromDate && tx.transactionDate < fromDate) continue
    if (toDate   && tx.transactionDate > toDate)   continue

    if (
      tx.transactionType === 'dividend' ||
      tx.transactionType === 'interest' ||
      tx.transactionType === 'rental_income'
    ) {
      total = total.plus(new Decimal(tx.amount))
    } else if (tx.transactionType === 'cost') {
      total = total.minus(new Decimal(tx.amount))
    }
  }

  return total.toDecimalPlaces(2)
}
