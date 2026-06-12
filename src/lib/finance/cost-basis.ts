import Decimal from 'decimal.js'

type TxInput = {
  transactionType: string
  amount: string
  quantity?: string | null
}

/**
 * Calculates the average cost basis per unit using the AVCO method.
 * Only considers 'buy' and 'sell' transactions.
 * Returns cost per unit, or Decimal(0) if no position.
 */
export function calculateCostBasis(transactions: TxInput[]): Decimal {
  let totalQty = new Decimal(0)
  let totalCost = new Decimal(0)

  for (const tx of transactions) {
    if (!tx.quantity) continue
    const qty = new Decimal(tx.quantity)

    if (tx.transactionType === 'buy') {
      totalQty = totalQty.plus(qty)
      totalCost = totalCost.plus(new Decimal(tx.amount))
    } else if (tx.transactionType === 'sell') {
      if (totalQty.gt(0)) {
        const avgCost = totalCost.div(totalQty)
        totalCost = totalCost.minus(avgCost.mul(qty))
        totalQty = totalQty.minus(qty)
      }
    }
  }

  if (totalQty.lte(0)) return new Decimal(0)
  return totalCost.div(totalQty).toDecimalPlaces(4)
}

/**
 * Returns the total quantity currently held (buys minus sells).
 */
export function calculateQuantityHeld(transactions: TxInput[]): Decimal {
  let qty = new Decimal(0)
  for (const tx of transactions) {
    if (!tx.quantity) continue
    if (tx.transactionType === 'buy')  qty = qty.plus(new Decimal(tx.quantity))
    if (tx.transactionType === 'sell') qty = qty.minus(new Decimal(tx.quantity))
  }
  return qty
}
