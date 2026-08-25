'use client'

import { useMemo, useState } from 'react'
import Decimal from 'decimal.js'
import { useSortable } from '@/lib/utils/use-sortable'
import { SortableHeader } from '@/components/ui/SortableHeader'
import { calculateOneTimeExpensesTotal } from '@/lib/finance'
import { formatCurrencyPrecise } from '@/lib/utils/format'
import { OneTimeExpenseRow } from './OneTimeExpenseRow'
import { ONE_TIME_EXPENSE_CATEGORY_LABELS } from './one-time-expense-labels'
import type { OneTimeExpense } from '@/lib/db/queries/one-time-expenses'

type SortKey = 'name' | 'category' | 'expenseDate' | 'amount' | 'isShared'
type SharedFilter = 'all' | 'shared' | 'not_shared'

interface OneTimeExpenseListProps {
  expenses: OneTimeExpense[]
  updateAction: (formData: FormData) => Promise<void>
  deleteAction: (formData: FormData) => Promise<void>
}

export function OneTimeExpenseList({ expenses, updateAction, deleteAction }: OneTimeExpenseListProps) {
  const { sort, toggle, sorted } = useSortable<SortKey>('expenseDate', 'desc')

  const [nameQuery, setNameQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [sharedFilter, setSharedFilter] = useState<SharedFilter>('all')
  const [yearFilter, setYearFilter] = useState('all')

  const yearOptions = useMemo(
    () => [...new Set(expenses.map(e => e.expenseDate.slice(0, 4)))].sort((a, b) => b.localeCompare(a)),
    [expenses],
  )
  const categoryOptions = useMemo(
    () => [...new Set(expenses.map(e => e.category))].sort((a, b) =>
      (ONE_TIME_EXPENSE_CATEGORY_LABELS[a] ?? a).localeCompare(ONE_TIME_EXPENSE_CATEGORY_LABELS[b] ?? b, 'nl'),
    ),
    [expenses],
  )

  const filtered = expenses.filter(expense => {
    if (nameQuery.trim() !== '' && !expense.name.toLowerCase().includes(nameQuery.trim().toLowerCase())) return false
    if (categoryFilter !== 'all' && expense.category !== categoryFilter) return false
    if (sharedFilter === 'shared' && !expense.isShared) return false
    if (sharedFilter === 'not_shared' && expense.isShared) return false
    if (yearFilter !== 'all' && expense.expenseDate.slice(0, 4) !== yearFilter) return false
    return true
  })

  const data = sorted(filtered, (key, expense) => {
    if (key === 'name')        return expense.name
    if (key === 'category')    return ONE_TIME_EXPENSE_CATEGORY_LABELS[expense.category] ?? expense.category
    if (key === 'expenseDate') return expense.expenseDate
    if (key === 'amount')      return new Decimal(expense.amount).toNumber()
    if (key === 'isShared')    return expense.isShared ? 1 : 0
    return null
  })

  const total = calculateOneTimeExpensesTotal(filtered)

  return (
    <div className="bg-card border border-border rounded-3xl overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 px-6 py-4 border-b border-border">
        <input
          type="text"
          value={nameQuery}
          onChange={(e) => setNameQuery(e.target.value)}
          placeholder="Zoeken op naam..."
          className="flex-1 min-w-40 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="all">Alle categorieën</option>
          {categoryOptions.map(value => (
            <option key={value} value={value}>{ONE_TIME_EXPENSE_CATEGORY_LABELS[value] ?? value}</option>
          ))}
        </select>
        <select
          value={sharedFilter}
          onChange={(e) => setSharedFilter(e.target.value as SharedFilter)}
          className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="all">Gedeeld: alle</option>
          <option value="shared">Alleen gezamenlijk</option>
          <option value="not_shared">Alleen niet-gezamenlijk</option>
        </select>
        <select
          value={yearFilter}
          onChange={(e) => setYearFilter(e.target.value)}
          className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="all">Alle jaren</option>
          {yearOptions.map(year => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left px-6 py-3 font-medium"><SortableHeader label="Naam" sortKey="name" sort={sort} onToggle={toggle} /></th>
            <th className="text-left px-6 py-3 font-medium"><SortableHeader label="Categorie" sortKey="category" sort={sort} onToggle={toggle} /></th>
            <th className="text-left px-6 py-3 font-medium"><SortableHeader label="Datum" sortKey="expenseDate" sort={sort} onToggle={toggle} /></th>
            <th className="text-right px-6 py-3 font-medium"><SortableHeader label="Bedrag" sortKey="amount" sort={sort} onToggle={toggle} /></th>
            <th className="text-center px-6 py-3 font-medium"><SortableHeader label="Gedeeld" sortKey="isShared" sort={sort} onToggle={toggle} /></th>
            <th className="px-6 py-3" />
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-6 py-8 text-center text-sm text-muted-foreground italic">
                Geen uitgaven gevonden voor deze filters.
              </td>
            </tr>
          ) : (
            data.map(expense => (
              <OneTimeExpenseRow
                key={expense.id}
                expense={expense}
                updateAction={updateAction}
                deleteAction={deleteAction}
              />
            ))
          )}
        </tbody>
        <tfoot>
          <tr className="border-t border-border bg-muted/30">
            <td colSpan={3} className="px-6 py-3 text-sm font-medium text-foreground">
              Totaal ({data.length} {data.length === 1 ? 'uitgave' : 'uitgaven'})
            </td>
            <td className="px-6 py-3 text-right font-semibold text-foreground">
              {formatCurrencyPrecise(total.toNumber())}
            </td>
            <td colSpan={2} />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
