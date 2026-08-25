'use client'

import { useState } from 'react'
import { Pencil, Trash2, Check, X, Users } from 'lucide-react'
import Decimal from 'decimal.js'
import { formatCurrencyPrecise, formatDate } from '@/lib/utils/format'
import { ONE_TIME_EXPENSE_CATEGORY_LABELS } from './one-time-expense-labels'
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
      <tr className="border-b border-border last:border-0 bg-muted/30">
        <td className="px-6 py-4" colSpan={6}>
          <form action={handleSave} className="space-y-3">
            <input type="hidden" name="expenseId" value={expense.id} />
            <div className="flex flex-wrap items-center gap-2">
              <input
                name="name"
                defaultValue={expense.name}
                required
                className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm w-40 focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <select
                name="category"
                required
                defaultValue={expense.category}
                className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {Object.entries(ONE_TIME_EXPENSE_CATEGORY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
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
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  name="isShared"
                  defaultChecked={expense.isShared}
                  className="rounded border-border text-sage focus:ring-1 focus:ring-primary"
                />
                Gezamenlijk betaald
              </label>

              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  aria-label="Opslaan"
                  title="Opslaan"
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-sage hover:bg-sage/10 transition-colors"
                >
                  <Check size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  aria-label="Annuleren"
                  title="Annuleren"
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          </form>
        </td>
      </tr>
    )
  }

  return (
    <tr className="border-b border-border last:border-0">
      <td className="px-6 py-3 font-medium text-foreground">{expense.name}</td>
      <td className="px-6 py-3 text-muted-foreground">
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted">
          {ONE_TIME_EXPENSE_CATEGORY_LABELS[expense.category] ?? expense.category}
        </span>
      </td>
      <td className="px-6 py-3 text-muted-foreground">{formatDate(expense.expenseDate)}</td>
      <td className="px-6 py-3 text-right">
        <div className="font-medium text-foreground">
          {formatCurrencyPrecise(new Decimal(expense.amount).toNumber())}
        </div>
        {expense.isShared && (
          <div className="text-xs text-muted-foreground">
            eigen aandeel {formatCurrencyPrecise(new Decimal(expense.amount).dividedBy(2).toNumber())}
          </div>
        )}
      </td>
      <td className="px-6 py-3 text-center">
        {expense.isShared && (
          <span title="Gezamenlijk betaald" className="inline-flex">
            <Users size={15} className="text-muted-foreground" aria-label="Gezamenlijk betaald" />
          </span>
        )}
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
