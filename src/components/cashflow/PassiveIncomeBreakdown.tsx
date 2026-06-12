import { formatCurrency } from '@/lib/utils/format'
import type Decimal from 'decimal.js'

type BreakdownProps = {
  dividend: Decimal
  interest: Decimal
  rentalNet: Decimal
}

export function PassiveIncomeBreakdown({ dividend, interest, rentalNet }: BreakdownProps) {
  const items = [
    { label: 'Dividend',   value: dividend },
    { label: 'Rente',      value: interest },
    { label: 'Huur netto', value: rentalNet },
  ]

  const allZero = items.every(i => i.value.lte(0))

  if (allZero) {
    return (
      <div className="bg-card border border-border rounded-3xl p-6">
        <p className="text-sm font-medium text-foreground mb-4">Passief inkomen breakdown</p>
        <p className="text-sm text-muted-foreground italic">
          Nog geen passief inkomen geregistreerd dit jaar.
        </p>
      </div>
    )
  }

  const max = Math.max(...items.map(i => i.value.toNumber()), 1)

  return (
    <div className="bg-card border border-border rounded-3xl p-6">
      <p className="text-sm font-medium text-foreground mb-6">Passief inkomen breakdown</p>
      <div className="space-y-4">
        {items.map(({ label, value }) => {
          const pct = Math.max((value.toNumber() / max) * 100, 0)
          return (
            <div key={label} className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground w-24 shrink-0">{label}</span>
              <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-[--color-chart-primary] transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-sm font-medium text-foreground w-20 text-right">
                {formatCurrency(value.toNumber())}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
