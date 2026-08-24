'use client'

import { useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import Decimal from 'decimal.js'
import { formatCurrencyPrecise, formatDate } from '@/lib/utils/format'
import type { OneTimeExpense } from '@/lib/db/queries/one-time-expenses'

interface OneTimeExpenseRowProps {
  expense: OneTimeExpense
  updateAction: (formData: FormData) => Promise<void>
  deleteAction: (formData: FormData) => Promise<void>
}

export function OneTimeExpenseRow({ expense, updateAction, deleteAction }: OneTimeExpenseRowProps) {
  const [editing, setEditing] = useState(false)

  async function handleSave(formData: FormData) {
    await updateAction(formData)
    setEditing(false)
  }

  if (editing) {
    return (
      <tr className="border-b border-border last:border-0">
        <td className="px-6 py-3" colSpan={4}>
          <form action={handleSave} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="expenseId" value={expense.id} />
            <input
              name="name"
              defaultValue={expense.name}
              required
              className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm w-40 focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <input
              name="amount"
              type="number"
              step="0.01"
              min="0"
              required
              defaultValue={expense.amount}
              className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm w-28 focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <input
              name="expenseDate"
              type="date"
              required
              defaultValue={expense.expenseDate}
              className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button type="submit" className="text-xs font-medium text-sage hover:opacity-70 transition-opacity">
              Opslaan
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Annuleren
            </button>
          </form>
        </td>
      </tr>
    )
  }

  return (
    <tr className="border-b border-border last:border-0">
      <td className="px-6 py-3 font-medium text-foreground">{expense.name}</td>
      <td className="px-6 py-3 text-muted-foreground">{formatDate(expense.expenseDate)}</td>
      <td className="px-6 py-3 text-right font-medium text-foreground">
        {formatCurrencyPrecise(new Decimal(expense.amount).toNumber())}
      </td>
      <td className="px-6 py-3">
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label="Bewerken"
            title="Bewerken"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <Pencil size={15} />
          </button>
          <form
            action={deleteAction}
            onSubmit={(e) => { if (!confirm(`'${expense.name}' verwijderen?`)) e.preventDefault() }}
          >
            <input type="hidden" name="expenseId" value={expense.id} />
            <button type="submit" aria-label="Verwijderen" title="Verwijderen" className="text-muted-foreground hover:text-terracotta transition-colors">
              <Trash2 size={15} />
            </button>
          </form>
        </div>
      </td>
    </tr>
  )
}
