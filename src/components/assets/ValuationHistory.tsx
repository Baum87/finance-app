import { formatCurrency } from '@/lib/utils/format'
import { DeleteValuationButton } from '@/components/portfolio/DeleteValuationButton'

type Valuation = {
  id: string
  valuationDate: string
  value: string
}

type Props = {
  assetId: string
  valuations: Valuation[]
}

function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('nl-NL', {
    day: 'numeric', month: 'short', year: 'numeric',
  }).format(new Date(dateStr + 'T00:00:00'))
}

export function ValuationHistory({ assetId, valuations }: Props) {
  return (
    <div className="space-y-1 pt-4 border-t border-border">
      <p className="text-xs font-medium text-muted-foreground mb-2">Waarderingshistorie</p>
      {valuations.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nog geen waarderingen. Voeg de huidige waarde toe.
        </p>
      ) : (
        valuations.map(v => (
          <div key={v.id} className="flex items-center justify-between py-1.5">
            <span className="text-sm text-muted-foreground">{formatDate(v.valuationDate)}</span>
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-foreground">
                {formatCurrency(Number(v.value))}
              </span>
              <DeleteValuationButton
                valuationId={v.id}
                redirectTo={`/assets/${assetId}`}
              />
            </div>
          </div>
        ))
      )}
    </div>
  )
}
