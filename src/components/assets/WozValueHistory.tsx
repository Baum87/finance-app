'use client'

import { useState } from 'react'
import { Pencil, Trash2, Check, X } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/format'
import { updateWozValueAction, deleteWozValueAction } from '@/app/assets/actions'

type WozValue = {
  id: string
  wozDate: string
  value: string
}

type Props = {
  wozValues: WozValue[]
}

function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('nl-NL', {
    day: 'numeric', month: 'short', year: 'numeric',
  }).format(new Date(dateStr + 'T00:00:00'))
}

export function WozValueHistory({ wozValues }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)

  async function handleSave(fd: FormData) {
    await updateWozValueAction(fd)
    setEditingId(null)
  }

  return (
    <div className="space-y-1 pt-4 border-t border-border">
      <p className="text-xs font-medium text-muted-foreground mb-2">WOZ-historie</p>
      {wozValues.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nog geen WOZ-waarde ingevoerd.
        </p>
      ) : (
        wozValues.map(w => {
          if (editingId === w.id) {
            return (
              <form key={w.id} action={handleSave} className="flex items-center gap-2 py-1.5">
                <input type="hidden" name="wozValueId" value={w.id} />
                <input
                  name="wozDate"
                  type="date"
                  defaultValue={w.wozDate}
                  className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
                />
                <input
                  name="value"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={w.value}
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
            <div key={w.id} className="flex items-center justify-between py-1.5">
              <span className="text-sm text-muted-foreground">{formatDate(w.wozDate)}</span>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-foreground">
                  {formatCurrency(Number(w.value))}
                </span>
                <button
                  type="button"
                  onClick={() => setEditingId(w.id)}
                  aria-label="Bewerken"
                  title="Bewerken"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Pencil size={14} />
                </button>
                <form action={deleteWozValueAction}>
                  <input type="hidden" name="wozValueId" value={w.id} />
                  <button
                    type="submit"
                    aria-label="Verwijderen"
                    title="Verwijderen"
                    className="text-muted-foreground hover:text-terracotta transition-colors"
                    onClick={e => { if (!confirm('WOZ-waarde verwijderen?')) e.preventDefault() }}
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
