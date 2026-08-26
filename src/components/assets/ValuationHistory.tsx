'use client'

import { useState } from 'react'
import { Pencil, Trash2, Check, X } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/format'
import { updateValuationAction, deleteValuationAction } from '@/app/assets/actions'

type Valuation = {
  id: string
  valuationDate: string
  value: string
}

type Props = {
  valuations: Valuation[]
}

function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('nl-NL', {
    day: 'numeric', month: 'short', year: 'numeric',
  }).format(new Date(dateStr + 'T00:00:00'))
}

export function ValuationHistory({ valuations }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)

  async function handleSave(fd: FormData) {
    await updateValuationAction(fd)
    setEditingId(null)
  }

  return (
    <div className="space-y-1 pt-4 border-t border-border">
      <p className="text-xs font-medium text-muted-foreground mb-2">Waarderingshistorie</p>
      {valuations.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nog geen waarderingen. Voeg de huidige waarde toe.
        </p>
      ) : (
        valuations.map(v => {
          if (editingId === v.id) {
            return (
              <form key={v.id} action={handleSave} className="flex items-center gap-2 py-1.5">
                <input type="hidden" name="valuationId" value={v.id} />
                <input
                  name="valuationDate"
                  type="date"
                  defaultValue={v.valuationDate}
                  className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
                />
                <input
                  name="value"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={v.value}
                  className="h-8 w-28 rounded-md border border-input bg-transparent px-2 text-sm"
                />
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
            <div key={v.id} className="flex items-center justify-between py-1.5">
              <span className="text-sm text-muted-foreground">{formatDate(v.valuationDate)}</span>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-foreground">
                  {formatCurrency(Number(v.value))}
                </span>
                <button
                  type="button"
                  onClick={() => setEditingId(v.id)}
                  aria-label="Bewerken"
                  title="Bewerken"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Pencil size={14} />
                </button>
                <form action={deleteValuationAction}>
                  <input type="hidden" name="valuationId" value={v.id} />
                  <button
                    type="submit"
                    aria-label="Verwijderen"
                    title="Verwijderen"
                    className="text-muted-foreground hover:text-terracotta transition-colors"
                    onClick={e => { if (!confirm('Waardering verwijderen?')) e.preventDefault() }}
                  >
                    <Trash2 size={14} />
                  </button>
                </form>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
