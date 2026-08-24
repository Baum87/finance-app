'use client'

import Decimal from 'decimal.js'
import { useSortable } from '@/lib/utils/use-sortable'
import { SortableHeader } from '@/components/ui/SortableHeader'
import { OneTimeExpenseRow } from './OneTimeExpenseRow'
import type { OneTimeExpense } from '@/lib/db/queries/one-time-expenses'

type SortKey = 'name' | 'expenseDate' | 'amount' | 'isShared'

interface OneTimeExpenseListProps {
  expenses: OneTimeExpense[]
  updateAction: (formData: FormData) => Promise<void>
  deleteAction: (formData: FormData) => Promise<void>
}

export function OneTimeExpenseList({ expenses, updateAction, deleteAction }: OneTimeExpenseListProps) {
  const { sort, toggle, sorted } = useSortable<SortKey>('expenseDate', 'desc')

  const data = sorted(expenses, (key, expense) => {
    if (key === 'name')        return expense.name
    if (key === 'expenseDate') return expense.expenseDate
    if (key === 'amount')      return new Decimal(expense.amount).toNumber()
    if (key === 'isShared')    return expense.isShared ? 1 : 0
    return null
  })

  return (
    <div className="bg-card border border-border rounded-3xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left px-6 py-3 font-medium"><SortableHeader label="Naam" sortKey="name" sort={sort} onToggle={toggle} /></th>
            <th className="text-left px-6 py-3 font-medium"><SortableHeader label="Datum" sortKey="expenseDate" sort={sort} onToggle={toggle} /></th>
            <th className="text-right px-6 py-3 font-medium"><SortableHeader label="Bedrag" sortKey="amount" sort={sort} onToggle={toggle} /></th>
            <th className="text-center px-6 py-3 font-medium"><SortableHeader label="Gedeeld" sortKey="isShared" sort={sort} onToggle={toggle} /></th>
            <th className="px-6 py-3" />
          </tr>
        </thead>
        <tbody>
          {data.map(expense => (
            <OneTimeExpenseRow
              key={expense.id}
              expense={expense}
              updateAction={updateAction}
              deleteAction={deleteAction}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}
