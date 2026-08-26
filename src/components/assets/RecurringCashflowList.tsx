'use client'

import { useState } from 'react'
import { Pencil, Trash2, Check, X } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/format'
import { updateRecurringCashflowAction, deleteRecurringCashflowAction } from '@/app/assets/actions'

export type RecurringCashflow = {
  id: string
  cashflowType: string
  amount: string
  frequency: string
  startDate: string
  endDate: string | null
}

type Props = {
  items: RecurringCashflow[]
}

const TYPE_LABELS: Record<string, string> = {
  rental_income: 'Huurinkomst',
  cost:          'Kosten',
}

function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('nl-NL', {
    day: 'numeric', month: 'short', year: 'numeric',
  }).format(new Date(dateStr + 'T00:00:00'))
}

function periodLabel(item: RecurringCashflow): string {
  if (item.frequency === 'once') return `Eenmalig · ${formatDate(item.startDate)}`
  if (item.endDate) return `${formatDate(item.startDate)} – ${formatDate(item.endDate)}`
  return `Vanaf ${formatDate(item.startDate)} · doorlopend`
}

export function RecurringCashflowList({ items }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editFrequency, setEditFrequency] = useState<'monthly' | 'once'>('monthly')

  async function handleSave(fd: FormData) {
    await updateRecurringCashflowAction(fd)
    setEditingId(null)
  }

  function startEditing(item: RecurringCashflow) {
    setEditFrequency(item.frequency === 'once' ? 'once' : 'monthly')
    setEditingId(item.id)
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground pt-2">
        Nog geen doorlopende huur of kosten toegevoegd.
      </p>
    )
  }

  return (
    <div className="space-y-1 pt-4 border-t border-border">
      <p className="text-xs font-medium text-muted-foreground mb-2">Huur &amp; kosten</p>
      {items.map(item => {
        if (editingId === item.id) {
          return (
            <form key={item.id} action={handleSave} className="flex flex-wrap items-center gap-2 py-2">
              <input type="hidden" name="recurringCashflowId" value={item.id} />
              <select
                name="cashflowType"
                defaultValue={item.cashflowType}
                className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
              >
                <option value="rental_income">Huurinkomst</option>
                <option value="cost">Kosten</option>
              </select>
              <select
                name="frequency"
                value={editFrequency}
                onChange={e => setEditFrequency(e.target.value as 'monthly' | 'once')}
                className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
              >
                <option value="monthly">Maandelijks</option>
                <option value="once">Eenmalig</option>
              </select>
              <input
                name="amount"
                type="number"
                step="0.01"
                min="0"
                defaultValue={item.amount}
                className="h-8 w-24 rounded-md border border-input bg-transparent px-2 text-sm"
              />
              <input
                name="startDate"
                type="date"
                defaultValue={item.startDate}
                className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
              />
              {editFrequency === 'monthly' && (
                <input
                  name="endDate"
                  type="date"
                  defaultValue={item.endDate ?? ''}
                  className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
                />
              )}
              <button type="submit" aria-label="Opslaan" title="Opslaan" className="text-sage hover:opacity-70 transition-opacity">
                <Check size={16} />
              </button>
              <button type="button" onClick={() => setEditingId(null)} aria-label="Annuleren" title="Annuleren" className="text-muted-foreground hover:text-foreground transition-colors">
                <X size={16} />
              </button>
            </form>
          )
        }
        return (
          <div key={item.id} className="flex items-center justify-between py-1.5 gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">
                {TYPE_LABELS[item.cashflowType] ?? item.cashflowType}
              </span>
              <span className="text-sm text-muted-foreground truncate">{periodLabel(item)}</span>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-sm font-medium text-foreground">
                {formatCurrency(Number(item.amount))}{item.frequency === 'monthly' ? ' / mnd' : ''}
              </span>
              <button
                type="button"
                onClick={() => startEditing(item)}
                aria-label="Bewerken"
                title="Bewerken"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <Pencil size={14} />
              </button>
              <form action={deleteRecurringCashflowAction}>
                <input type="hidden" name="recurringCashflowId" value={item.id} />
                <button
                  type="submit"
                  aria-label="Verwijderen"
                  title="Verwijderen"
                  className="text-muted-foreground hover:text-terracotta transition-colors"
                  onClick={e => { if (!confirm('Deze periode verwijderen?')) e.preventDefault() }}
                >
                  <Trash2 size={14} />
                </button>
              </form>
            </div>
          </div>
        )
      })}
    </div>
  )
}
