import Link from 'next/link'
import { formatCurrency } from '@/lib/utils/format'

export type AssetPosition = {
  id: string
  name: string
  currentValue: number
}

type Props = {
  positions: AssetPosition[]
  addHref: string
  addLabel: string
  description: string
  /** Route om naar terug te linken vanaf de positie-detailpagina (bijv. '/portfolio/vastgoed'). */
  backTo: string
}

export function AssetPositionsCard({ positions, addHref, addLabel, description, backTo }: Props) {
  return (
    <div className="rounded-3xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div>
          <p className="text-sm font-medium text-foreground">Posities met transacties</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        </div>
        <Link
          href={addHref}
          className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity whitespace-nowrap"
        >
          {addLabel}
        </Link>
      </div>

      {positions.length === 0 ? (
        <div className="px-6 py-8 text-center">
          <p className="text-sm text-muted-foreground">Nog geen positie met transacties aangemaakt.</p>
        </div>
      ) : (
        <div className="divide-y divide-border/60">
          {positions.map(p => (
            <Link
              key={p.id}
              href={`/assets/${p.id}?from=${encodeURIComponent(backTo)}`}
              className="flex items-center justify-between px-6 py-3 hover:bg-muted/40 transition-colors"
            >
              <span className="text-sm font-medium text-foreground">{p.name}</span>
              <span className="text-sm text-muted-foreground">
                {p.currentValue > 0 ? formatCurrency(p.currentValue) : '—'}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
