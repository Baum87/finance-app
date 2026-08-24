'use client'

import { useState } from 'react'
import { Pencil, Trash2, Check, X, Users } from 'lucide-react'
import Decimal from 'decimal.js'
import { formatCurrencyPrecise, formatDate } from '@/lib/utils/format'
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
  const [amount, setAmount] = useState(item.amount)

  async function handleSave(formData: FormData) {
    await updateAction(formData)
    setEditing(false)
  }

  if (editing) {
    return (
      <tr className="border-b border-border last:border-0 bg-muted/30">
        <td className="px-6 py-4" colSpan={7}>
          <form action={handleSave} className="space-y-3">
            <input type="hidden" name="itemId" value={item.id} />

            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Naam</label>
                <input
                  name="name"
                  defaultValue={item.name}
                  required
                  className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Soort</label>
                <select
                  name="itemType"
                  required
                  value={itemType}
                  onChange={(e) => setItemType(e.target.value as 'income' | 'expense')}
                  className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
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
                  defaultValue={item.category}
                  className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
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
                  defaultValue={item.frequency}
                  className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {Object.entries(FREQUENCY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Bedrag (€)</label>
                <input
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-muted-foreground whitespace-nowrap">Geldig vanaf</label>
                <input
                  name="effectiveDate"
                  type="date"
                  required
                  defaultValue={item.effectiveDate}
                  className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  name="isShared"
                  defaultChecked={item.isShared}
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
      <td className="px-6 py-3 text-right">
        <div className={`font-medium ${item.itemType === 'income' ? 'text-sage' : 'text-foreground'}`}>
          {item.itemType === 'income' ? '+' : '−'}{formatCurrencyPrecise(new Decimal(item.amount).toNumber())}
        </div>
        <div className="text-xs text-muted-foreground">sinds {formatDate(item.effectiveDate)}</div>
      </td>
      <td className="px-6 py-3 text-center">
        {item.isShared && (
          <span title="Gezamenlijk betaald" className="inline-flex">
            <Users size={15} className="text-muted-foreground" aria-label="Gezamenlijk betaald" />
          </span>
        )}
      </td>
      <td className="px-6 py-3">
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => {
              setItemType(item.itemType as 'income' | 'expense')
              setAmount(item.amount)
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
