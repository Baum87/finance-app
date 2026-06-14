import Decimal from 'decimal.js'

type TxInput = {
  transactionType: string
  amount: string
  transactionDate: string
}

export type PortfolioDataPoint = {
  month: string
  inleg: number
  waarde?: number
}

export function buildInlegSeries(txs: TxInput[]): PortfolioDataPoint[] {
  if (txs.length === 0) return []

  const sorted = [...txs].sort((a, b) =>
    a.transactionDate.localeCompare(b.transactionDate),
  )

  let running = new Decimal(0)
  const byMonth = new Map<string, Decimal>()

  for (const tx of sorted) {
    if (tx.transactionType === 'buy') {
      running = running.plus(new Decimal(tx.amount))
    } else if (tx.transactionType === 'sell') {
      running = running.minus(new Decimal(tx.amount))
    } else {
      continue
    }
    byMonth.set(tx.transactionDate.slice(0, 7), running)
  }

  return Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, val]) => {
      const [year, month] = key.split('-')
      const label = new Date(Number(year), Number(month) - 1).toLocaleDateString('nl-NL', {
        month: 'short',
        year: '2-digit',
      })
      return { month: label, inleg: val.toNumber() }
    })
}
