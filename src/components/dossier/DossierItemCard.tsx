import Decimal from 'decimal.js'
import type { DossierKind } from '@/lib/db/queries/dossier'
import { formatCurrencyPrecise, formatDate } from '@/lib/utils/format'
import { DOSSIER_SECTIONS, type DossierField } from './dossier-fields'

type Props = {
  kind: DossierKind
  item: Record<string, unknown>
}

function displayValue(field: DossierField, value: unknown): string | null {
  if (typeof value !== 'string' || value === '') return null
  switch (field.type) {
    case 'date':   return formatDate(value)
    case 'money':  return formatCurrencyPrecise(new Decimal(value).toNumber())
    case 'select': return field.options?.[value] ?? value
    default:       return value
  }
}

/** Leesweergave van één dossier-item: kopregel + alleen de ingevulde velden. */
export function DossierItemCard({ kind, item }: Props) {
  const section = DOSSIER_SECTIONS[kind]
  // Selectvelden zitten al in de kopregel; textarea's krijgen de volle breedte.
  const rows = section.fields
    .filter(f => f.type !== 'select')
    .map(f => ({ field: f, value: displayValue(f, item[f.name]) }))
    .filter((r): r is { field: DossierField; value: string } => r.value != null)

  return (
    <div className="bg-card border border-border rounded-3xl p-6 break-inside-avoid print:rounded-xl print:p-4">
      <p className="text-sm font-semibold text-foreground">{section.heading(item)}</p>
      {rows.length > 0 && (
        <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
          {rows.map(({ field, value }) => (
            <div key={field.name} className={field.type === 'textarea' ? 'sm:col-span-2' : ''}>
              <dt className="text-xs text-muted-foreground">{field.label.replace(/ \(€\)$/, '')}</dt>
              <dd className="text-foreground whitespace-pre-line">{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}
