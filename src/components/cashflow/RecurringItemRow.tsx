'use client'

import { useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import Decimal from 'decimal.js'
import { formatCurrency } from '@/lib/utils/format'
import { ITEM_TYPE_LABELS, CATEGORY_LABELS, FREQUENCY_LABELS, CATEGORIES_BY_TYPE } from './recurring-item-labels'
import type { RecurringItem } from '@/lib/db/queries/recurring-items'

interface RecurringItemRowProps {
  item: RecurringItem
  updateAction: (formData: FormData) => Promise<void>
  deleteAction: (formData: FormData) => Promise<void>
}

export function RecurringItemRow({ item, updateAction, deleteAction }: RecurringItemRowProps) {
  const [editing, setEditing] = useState(false)
  const [itemType, setItemType] = useState<'income' | 'expense'>(item.itemType as 'income' | 'expense')

  async function handleSave(formData: FormData) {
    await updateAction(formData)
    setEditing(false)
  }

  if (editing) {
    return (
      <tr className="border-b border-border last:border-0">
        <td className="px-6 py-3" colSpan={6}>
          <form action={handleSave} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="itemId" value={item.id} />
            <input
              name="name"
              defaultValue={item.name}
              required
              className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm w-40 focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <select
              name="itemType"
              required
              value={itemType}
              onChange={(e) => setItemType(e.target.value as 'income' | 'expense')}
              className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {Object.entries(ITEM_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <select
              name="category"
              required
              defaultValue={item.category}
              className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {CATEGORIES_BY_TYPE[itemType].map(value => (
                <option key={value} value={value}>{CATEGORY_LABELS[value]}</option>
              ))}
            </select>
            <select
              name="frequency"
              required
              defaultValue={item.frequency}
              className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {Object.entries(FREQUENCY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <input
              name="amount"
              type="number"
              step="0.01"
              min="0"
              required
              defaultValue={item.amount}
              className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm w-28 focus:outline-none focus:ring-1 focus:ring-primary"
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
      <td className="px-6 py-3 font-medium text-foreground">{item.name}</td>
      <td className="px-6 py-3 text-muted-foreground">{ITEM_TYPE_LABELS[item.itemType] ?? item.itemType}</td>
      <td className="px-6 py-3 text-muted-foreground">
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted">
          {CATEGORY_LABELS[item.category] ?? item.category}
        </span>
      </td>
      <td className="px-6 py-3 text-muted-foreground">
        {FREQUENCY_LABELS[item.frequency] ?? item.frequency}
      </td>
      <td className={`px-6 py-3 text-right font-medium ${item.itemType === 'income' ? 'text-sage' : 'text-foreground'}`}>
        {item.itemType === 'income' ? '+' : '−'}{formatCurrency(new Decimal(item.amount).toNumber())}
      </td>
      <td className="px-6 py-3">
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => {
              setItemType(item.itemType as 'income' | 'expense')
              setEditing(true)
            }}
            aria-label="Bewerken"
            title="Bewerken"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <Pencil size={15} />
          </button>
          <form
            action={deleteAction}
            onSubmit={(e) => { if (!confirm(`'${item.name}' verwijderen?`)) e.preventDefault() }}
          >
            <input type="hidden" name="itemId" value={item.id} />
            <button type="submit" aria-label="Verwijderen" title="Verwijderen" className="text-muted-foreground hover:text-terracotta transition-colors">
              <Trash2 size={15} />
            </button>
          </form>
        </div>
      </td>
    </tr>
  )
}
