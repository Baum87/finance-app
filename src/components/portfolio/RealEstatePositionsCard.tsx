import Link from 'next/link'
import { formatCurrency } from '@/lib/utils/format'

export type RealEstatePosition = {
  id: string
  name: string
  currentValue: number
  wozValue: number | null
  outstandingMortgage: number | null
  isRental: boolean
  rentalIncomeThisYear: number
  costsThisYear: number
}

type Props = {
  positions: RealEstatePosition[]
  addHref: string
}

function money(value: number | null): string {
  return value != null && value !== 0 ? formatCurrency(value) : '—'
}

export function RealEstatePositionsCard({ positions, addHref }: Props) {
  return (
    <div className="rounded-3xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <p className="text-sm font-medium text-foreground">Jouw panden</p>
        <Link
          href={addHref}
          className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity whitespace-nowrap"
        >
          + Pand toevoegen
        </Link>
      </div>

      {positions.length === 0 ? (
        <div className="px-6 py-8 text-center">
          <p className="text-sm text-muted-foreground">Nog geen pand toegevoegd.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted border-b border-border">
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">Pand</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Waarde</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">WOZ-waarde</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Restant hypotheek</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Huur dit jaar</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Kosten dit jaar</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((p, i) => (
                <tr key={p.id} className={i < positions.length - 1 ? 'border-b border-border' : ''}>
                  <td className="px-6 py-3 font-medium text-foreground">
                    <Link
                      href={`/assets/${p.id}?from=${encodeURIComponent('/portfolio/vastgoed')}`}
                      className="hover:text-primary transition-colors"
                    >
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right text-foreground">{money(p.currentValue)}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{money(p.wozValue)}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{money(p.outstandingMortgage)}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{p.isRental ? money(p.rentalIncomeThisYear) : '—'}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{p.isRental ? money(p.costsThisYear) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
