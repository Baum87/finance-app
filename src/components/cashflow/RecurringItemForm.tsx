'use client'

import { useRef, useState } from 'react'
import type { ActionState } from '@/app/assets/actions'
import { ITEM_TYPE_LABELS, CATEGORY_LABELS, FREQUENCY_LABELS } from './recurring-item-labels'

const CATEGORIES_BY_TYPE: Record<string, string[]> = {
  income:  ['salary', 'other'],
  expense: ['insurance', 'subscription', 'mortgage', 'municipal_tax', 'groceries', 'other'],
}

interface RecurringItemFormProps {
  action: (formData: FormData) => Promise<ActionState>
}

export function RecurringItemForm({ action }: RecurringItemFormProps) {
  const formRef = useRef<HTMLFormElement>(null)
  const [itemType, setItemType] = useState<'income' | 'expense'>('expense')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(formData: FormData) {
    const result = await action(formData)
    if (result?.error) {
      setError(result.error)
      return
    }
    setError(null)
    formRef.current?.reset()
    setItemType('expense')
  }

  return (
    <form ref={formRef} action={handleSubmit} className="bg-card border border-border rounded-3xl p-6 space-y-4">
      <p className="text-sm font-medium text-foreground">Vaste last of inkomen toevoegen</p>

      {error && (
        <div className="rounded-lg border border-terracotta/30 bg-terracotta/10 p-3 text-sm text-terracotta">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Naam</label>
          <input
            name="name"
            required
            placeholder="bijv. Zorgverzekering"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Soort</label>
          <select
            name="itemType"
            required
            value={itemType}
            onChange={(e) => setItemType(e.target.value as 'income' | 'expense')}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {Object.entries(ITEM_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Categorie</label>
          <select
            name="category"
            required
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {CATEGORIES_BY_TYPE[itemType].map(value => (
              <option key={value} value={value}>{CATEGORY_LABELS[value]}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Frequentie</label>
          <select
            name="frequency"
            required
            defaultValue="monthly"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {Object.entries(FREQUENCY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Bedrag per periode (€)</label>
          <input
            name="amount"
            type="number"
            step="0.01"
            min="0"
            required
            placeholder="0.00"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Toevoegen
        </button>
      </div>
    </form>
  )
}
