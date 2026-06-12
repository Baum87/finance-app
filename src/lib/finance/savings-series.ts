import Decimal from 'decimal.js'

type TxInput = {
  transactionType: string
  amount: string
  transactionDate: string
}

export type SavingsDataPoint = {
  month: string      // "jan '24"
  balance: number    // running balance (deposits - withdrawals + interest)
  deposits: number   // cumulative deposits only (no interest)
}

/**
 * Builds a monthly time series for a savings account (or group of accounts).
 * Returns one data point per month that has at least one transaction.
 * "deposits" = only what the user put in (deposit type).
 * "balance"  = actual balance including interest and withdrawals.
 */
export function buildSavingsGrowthSeries(txs: TxInput[]): SavingsDataPoint[] {
  if (txs.length === 0) return []

  const sorted = [...txs].sort((a, b) =>
    a.transactionDate.localeCompare(b.transactionDate),
  )

  let runningBalance  = new Decimal(0)
  let runningDeposits = new Decimal(0)

  const byMonth = new Map<string, { balance: Decimal; deposits: Decimal }>()

  for (const tx of sorted) {
    const amount = new Decimal(tx.amount)

    if (tx.transactionType === 'deposit') {
      runningBalance  = runningBalance.plus(amount)
      runningDeposits = runningDeposits.plus(amount)
    } else if (tx.transactionType === 'withdrawal') {
      runningBalance  = runningBalance.minus(amount)
    } else if (tx.transactionType === 'interest') {
      runningBalance  = runningBalance.plus(amount)
    }

    const monthKey = tx.transactionDate.slice(0, 7) // "2024-01"
    byMonth.set(monthKey, {
      balance:  runningBalance,
      deposits: runningDeposits,
    })
  }

  return Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, val]) => {
      const [year, month] = key.split('-')
      const label = new Date(Number(year), Number(month) - 1).toLocaleDateString('nl-NL', {
        month: 'short',
        year:  '2-digit',
      })
      return {
        month:    label,
        balance:  val.balance.toNumber(),
        deposits: val.deposits.toNumber(),
      }
    })
}
