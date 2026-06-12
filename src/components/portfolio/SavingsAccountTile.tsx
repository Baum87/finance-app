import Link from 'next/link'
import { formatCurrency } from '@/lib/utils/format'

type Props = {
  id: string
  name: string
  bankName: string
  accountType: string
  interestRate: string | null
  balance: number
}

export function SavingsAccountTile({ id, name, bankName, accountType, interestRate, balance }: Props) {
  const rateNum = interestRate ? parseFloat(interestRate) : null

  return (
    <Link
      href={`/assets/${id}`}
      className="block bg-card border border-border rounded-2xl p-6 hover:border-primary/40 transition-colors group"
    >
      <div className="mb-4">
        <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
          {name}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">{bankName}</p>
      </div>

      <p className="text-2xl font-semibold text-foreground tabular-nums">
        {formatCurrency(balance)}
      </p>

      <div className="mt-4 pt-4 border-t border-border flex items-center gap-1">
        {rateNum !== null ? (
          <>
            <span className="text-xs text-muted-foreground">Rente</span>
            <span className="text-xs font-medium text-sage ml-1">{rateNum}%</span>
          </>
        ) : (
          <span className="text-xs text-muted-foreground">Geen rente opgegeven</span>
        )}
      </div>
    </Link>
  )
}
