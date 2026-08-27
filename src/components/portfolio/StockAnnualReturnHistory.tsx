'use client'

import { useState } from 'react'
import { Pencil, Trash2, Check, X } from 'lucide-react'
import { formatPercent } from '@/lib/utils/format'
import { updateStockAnnualReturnAction, deleteStockAnnualReturnAction } from '@/app/portfolio/investment-assumptions-actions'

type StockAnnualReturn = {
  id: string
  year: number
  returnPct: string
}

type Props = {
  returns: StockAnnualReturn[]
}

export function StockAnnualReturnHistory({ returns }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)

  async function handleSave(fd: FormData) {
    await updateStockAnnualReturnAction(fd)
    setEditingId(null)
  }

  return (
    <div className="rounded-3xl border border-border bg-card p-6 space-y-1">
      <p className="text-sm font-medium text-foreground mb-2">Rendement-geschiedenis</p>
      {returns.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nog geen jaar-rendement vastgelegd.</p>
      ) : (
        returns.map(r => {
          if (editingId === r.id) {
            return (
              <form key={r.id} action={handleSave} className="flex items-center gap-2 py-1.5">
                <input type="hidden" name="id" value={r.id} />
                <input
                  name="year"
                  type="number"
                  step="1"
                  defaultValue={r.year}
                  className="h-8 w-20 rounded-md border border-input bg-transparent px-2 text-sm"
                />
                <input
                  name="returnPct"
                  type="number"
                  step="0.01"
                  defaultValue={r.returnPct}
                  className="h-8 w-24 rounded-md border border-input bg-transparent px-2 text-sm"
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
          const returnDecimal = Number(r.returnPct) / 100
          return (
            <div key={r.id} className="flex items-center justify-between py-1.5">
              <span className="text-sm text-muted-foreground">{r.year}</span>
              <div className="flex items-center gap-3">
                <span className={`text-sm font-medium ${returnDecimal < 0 ? 'text-terracotta' : 'text-foreground'}`}>
                  {formatPercent(returnDecimal)}
                </span>
                <button
                  type="button"
                  onClick={() => setEditingId(r.id)}
                  aria-label="Bewerken"
                  title="Bewerken"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Pencil size={14} />
                </button>
                <form action={deleteStockAnnualReturnAction}>
                  <input type="hidden" name="id" value={r.id} />
                  <button
                    type="submit"
                    aria-label="Verwijderen"
                    title="Verwijderen"
                    className="text-muted-foreground hover:text-terracotta transition-colors"
                    onClick={e => { if (!confirm(`Rendement over ${r.year} verwijderen?`)) e.preventDefault() }}
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
