import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import Link from 'next/link'
import { deleteTransactionAction } from '@/app/assets/actions'
import type { Transaction } from '@/lib/db/queries/transactions'

const TX_TYPE_LABELS: Record<string, string> = {
  buy:           'Aankoop',
  sell:          'Verkoop',
  deposit:       'Storting',
  withdrawal:    'Opname',
  dividend:      'Dividend',
  interest:      'Rente',
  rental_income: 'Huurinkomst',
  cost:          'Kosten',
}

function formatAmount(amount: string, currency: string): string {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency }).format(Number(amount))
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function TransactionList({ transactions, assetId }: { transactions: Transaction[]; assetId: string }) {
  if (transactions.length === 0) {
    return (
      <div className="rounded-[24px] border border-border bg-card p-10 flex flex-col items-center gap-4">
        <p className="text-sm text-muted-foreground">Nog geen transacties.</p>
        <Link
          href={`/assets/${assetId}/transactions/new`}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Eerste transactie toevoegen
        </Link>
      </div>
    )
  }

  return (
    <div className="rounded-[24px] border border-border bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Datum</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="text-right">Bedrag</TableHead>
            <TableHead className="text-right">Aantal</TableHead>
            <TableHead>Notitie</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((tx) => (
            <TableRow key={tx.id}>
              <TableCell className="text-muted-foreground text-sm">{formatDate(tx.transactionDate)}</TableCell>
              <TableCell>
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                  {TX_TYPE_LABELS[tx.transactionType] ?? tx.transactionType}
                </span>
              </TableCell>
              <TableCell className="text-right font-medium">
                {formatAmount(tx.amount, tx.currency)}
              </TableCell>
              <TableCell className="text-right text-muted-foreground text-sm">
                {tx.quantity ?? '—'}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground max-w-[180px] truncate">
                {tx.notes ?? '—'}
              </TableCell>
              <TableCell className="text-right">
                <form action={deleteTransactionAction}>
                  <input type="hidden" name="transactionId" value={tx.id} />
                  <input type="hidden" name="assetId" value={assetId} />
                  <button
                    type="submit"
                    className="text-xs text-terracotta hover:opacity-70 transition-opacity"
                    onClick={(e) => {
                      if (!confirm('Transactie verwijderen?')) e.preventDefault()
                    }}
                  >
                    Verwijderen
                  </button>
                </form>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
