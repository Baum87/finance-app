import Link from 'next/link'
import { AssetSectionDeleteButton } from './AssetSectionDeleteButton'

export type SectionColumn = {
  header: string
  key: string
}

export type SectionRow = {
  id: string
  name: string
  currentValue: number
  currency: string
  details: Record<string, string | null>
}

type Props = {
  title: string
  addLabel: string
  addHref: string
  columns: SectionColumn[]
  rows: SectionRow[]
}

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency }).format(value)
}

export function AssetSection({ title, addLabel, addHref, columns, rows }: Props) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{rows.length} {rows.length === 1 ? 'item' : 'items'}</p>
        </div>
        <Link
          href={addHref}
          className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
        >
          {addLabel}
        </Link>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {rows.length === 0 ? (
          <div className="px-6 py-8 text-center">
            <p className="text-sm text-muted-foreground">Nog geen {title.toLowerCase()} toegevoegd.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted border-b border-border">
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Naam</th>
                {columns.map(col => (
                  <th key={col.key} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                    {col.header}
                  </th>
                ))}
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Waarde</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.id} className={i < rows.length - 1 ? 'border-b border-border' : ''}>
                  <td className="px-4 py-3 font-medium text-foreground">
                    <Link href={`/assets/${row.id}`} className="hover:text-primary transition-colors">
                      {row.name}
                    </Link>
                  </td>
                  {columns.map(col => (
                    <td key={col.key} className="px-4 py-3 text-muted-foreground">
                      {row.details[col.key] ?? '—'}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right font-medium text-foreground">
                    {row.currentValue > 0 ? formatCurrency(row.currentValue, row.currency) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <Link
                        href={`/assets/${row.id}/edit`}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Bewerken
                      </Link>
                      <AssetSectionDeleteButton assetId={row.id} assetName={row.name} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  )
}
