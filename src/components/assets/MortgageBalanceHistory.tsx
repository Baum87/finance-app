import Decimal from 'decimal.js'
import { formatCurrency } from '@/lib/utils/format'
import { DeleteMortgageBalanceButton } from '@/components/assets/DeleteMortgageBalanceButton'

type Balance = {
  id: string
  balanceDate: string
  outstandingBalance: string
}

type Props = {
  assetId: string
  originalAmount: string
  balances: Balance[]
}

function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('nl-NL', {
    day: 'numeric', month: 'short', year: 'numeric',
  }).format(new Date(dateStr + 'T00:00:00'))
}

export function MortgageBalanceHistory({ assetId, originalAmount, balances }: Props) {
  const orig = new Decimal(originalAmount)

  return (
    <div className="space-y-1 pt-4 border-t border-border">
      <p className="text-xs font-medium text-muted-foreground mb-2">Saldohistorie</p>
      {balances.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nog geen saldo ingevoerd. De app gebruikt nu het originele hypotheekbedrag als schatting.
        </p>
      ) : (
        balances.map(b => {
          const balance   = new Decimal(b.outstandingBalance)
          const afgelost  = orig.minus(balance)
          const pct       = orig.gt(0) ? afgelost.div(orig).mul(100).toDecimalPlaces(1) : new Decimal(0)
          return (
            <div key={b.id} className="flex items-center justify-between py-1.5">
              <span className="text-sm text-muted-foreground">{formatDate(b.balanceDate)}</span>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <span className="text-sm font-medium text-foreground">
                    {formatCurrency(balance.toNumber())}
                  </span>
                  {afgelost.gt(0) && (
                    <span className="ml-2 text-xs text-[var(--color-sage)]">
                      {formatCurrency(afgelost.toNumber())} afgelost ({pct.toNumber()}%)
                    </span>
                  )}
                </div>
                <DeleteMortgageBalanceButton
                  balanceId={b.id}
                  redirectTo={`/assets/${assetId}`}
                />
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
