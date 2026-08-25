import Decimal from 'decimal.js'

type OneTimeExpenseInput = {
  amount: string
  isShared: boolean
}

/**
 * Telt eenmalige uitgaven op tot een totaalbedrag. Gezamenlijk betaalde
 * uitgaven (isShared) tellen voor de helft mee — het eigen aandeel.
 */
export function calculateOneTimeExpensesTotal(expenses: OneTimeExpenseInput[]): Decimal {
  return expenses.reduce((sum, expense) => {
    const amount = new Decimal(expense.amount)
    return sum.plus(expense.isShared ? amount.dividedBy(2) : amount)
  }, new Decimal(0))
}
