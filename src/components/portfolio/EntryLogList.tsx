'use client'

import { useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils/format'

export type EntryLogField = {
  name: string
  label: string
  type?: 'text' | 'number' | 'date'
  /** Alleen voor weergave (niet-bewerk-modus). */
  format?: 'currency' | 'date'
}

function formatValue(raw: string, format: EntryLogField['format']): string {
  if (format === 'currency') return formatCurrency(Number(raw))
  if (format === 'date') return formatDate(raw)
  return raw
}

type Props = {
  fields: EntryLogField[]
  rows: Record<string, string>[]
  updateAction: (fd: FormData) => Promise<void>
  deleteAction: (fd: FormData) => Promise<void>
  footerLabel: string
  footerValue: string
}

export function EntryLogList({ fields, rows, updateAction, deleteAction, footerLabel, footerValue }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)

  const gridStyle = { gridTemplateColumns: `repeat(${fields.length}, 1fr) auto` }

  return (
    <div className="rounded-3xl border border-border bg-card overflow-hidden">
      <div className="grid text-sm" style={gridStyle}>
        <div className="contents">
          {fields.map(f => (
            <div key={f.name} className="px-4 py-3 text-xs font-medium text-muted-foreground border-b border-border/60">{f.label}</div>
          ))}
          <div className="px-4 py-3 border-b border-border/60" />
        </div>

        {rows.map((row, i) => {
          const isLast = i === rows.length - 1
          const borderCls = isLast ? '' : 'border-b border-border/40'

          if (editingId === row.id) {
            return (
              <form key={row.id} action={updateAction} className="contents">
                <input type="hidden" name="id" value={row.id} />
                {fields.map(f => (
                  <div key={f.name} className={`px-4 py-2 ${borderCls}`}>
                    <input
                      name={f.name}
                      type={f.type ?? 'text'}
                      defaultValue={row[f.name]}
                      className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                    />
                  </div>
                ))}
                <div className={`px-4 py-2 flex items-center gap-3 whitespace-nowrap ${borderCls}`}>
                  <button type="submit" className="text-xs font-medium text-sage hover:opacity-70 transition-opacity">Opslaan</button>
                  <button type="button" onClick={() => setEditingId(null)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Annuleren</button>
                </div>
              </form>
            )
          }

          return (
            <div key={row.id} className="contents">
              {fields.map(f => (
                <div key={f.name} className={`px-4 py-3 text-foreground ${borderCls}`}>
                  {formatValue(row[f.name], f.format)}
                </div>
              ))}
              <div className={`px-4 py-3 flex items-center gap-3 whitespace-nowrap ${borderCls}`}>
                <button
                  type="button"
                  onClick={() => setEditingId(row.id)}
                  aria-label="Bewerken"
                  title="Bewerken"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Pencil size={15} />
                </button>
                <form
                  action={deleteAction}
                  onSubmit={(e) => { if (!confirm('Deze regel verwijderen?')) e.preventDefault() }}
                >
                  <input type="hidden" name="id" value={row.id} />
                  <button type="submit" aria-label="Verwijderen" title="Verwijderen" className="text-muted-foreground hover:text-terracotta transition-colors">
                    <Trash2 size={15} />
                  </button>
                </form>
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-t border-border/60">
        <span className="text-sm font-medium text-muted-foreground">{footerLabel}</span>
        <span className="text-sm font-semibold text-foreground">{footerValue}</span>
      </div>
    </div>
  )
}
