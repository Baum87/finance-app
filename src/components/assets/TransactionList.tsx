'use client'

import Link from 'next/link'
import Decimal from 'decimal.js'
import { Pencil, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { deleteTransactionAction } from '@/app/assets/actions'
import { useSortable } from '@/lib/utils/use-sortable'
import { SortableHeader } from '@/components/ui/SortableHeader'
import { formatCurrency, formatQuantity } from '@/lib/utils/format'
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
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency }).format(new Decimal(amount).toNumber())
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
}


type SortKey = 'transactionDate' | 'transactionType' | 'amount' | 'quantity'

export function TransactionList({ transactions, assetId, addHref, redirectTo, currentPriceEur }: {
  transactions: Transaction[]
  assetId: string
  addHref?: string
  redirectTo?: string
  currentPriceEur?: number
}) {
  const router = useRouter()
  const { sort, toggle, sorted } = useSortable<SortKey>('transactionDate', 'desc')
  const showLotGain = !!currentPriceEur

  if (transactions.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-10 flex flex-col items-center gap-4">
        <p className="text-sm text-muted-foreground">Nog geen transacties.</p>
        <Link
          href={addHref ?? `/assets/${assetId}/transactions/new`}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Eerste transactie toevoegen
        </Link>
      </div>
    )
  }

  const data = sorted(transactions, (key, tx) => {
    if (key === 'transactionDate') return tx.transactionDate
    if (key === 'transactionType') return TX_TYPE_LABELS[tx.transactionType] ?? tx.transactionType
    if (key === 'amount') return new Decimal(tx.amount).toNumber()
    if (key === 'quantity') return tx.quantity ? new Decimal(tx.quantity).toNumber() : -Infinity
    return null
  })

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className={`grid gap-4 px-6 py-2.5 border-b border-border bg-muted/30 ${showLotGain ? 'grid-cols-[1fr_auto_auto_auto_auto_auto_auto_auto]' : 'grid-cols-[1fr_auto_auto_auto_auto_auto]'}`}>
        <SortableHeader label="Datum" sortKey="transactionDate" sort={sort} onToggle={toggle} />
        <SortableHeader label="Type" sortKey="transactionType" sort={sort} onToggle={toggle} className="w-24" />
        <SortableHeader label="Bedrag" sortKey="amount" sort={sort} onToggle={toggle} className="text-right w-28" />
        <SortableHeader label="Aantal" sortKey="quantity" sort={sort} onToggle={toggle} className="text-right w-20" />
        {showLotGain && (
          <>
            <span className="text-xs text-muted-foreground text-right w-28">Aankoopkoers</span>
            <span className="text-xs text-muted-foreground text-right w-28">Huidige koers</span>
            <span className="text-xs text-muted-foreground text-right w-28">W/V lot</span>
          </>
        )}
        <span className="w-16" />
      </div>

      <div className="divide-y divide-border">
        {data.map(tx => {
          const isBuy = tx.transactionType === 'buy'
          const lotGain = showLotGain && isBuy && tx.pricePerUnit && tx.quantity
            ? (currentPriceEur! - new Decimal(tx.pricePerUnit).toNumber()) * new Decimal(tx.quantity).toNumber()
            : null
          const lotPos = lotGain !== null && lotGain >= 0

          const editHref = `/assets/${assetId}/transactions/${tx.id}/edit${redirectTo ? `?from=${encodeURIComponent(redirectTo)}` : ''}`
          return (
            <div
              key={tx.id}
              onClick={() => router.push(editHref)}
              className={`grid gap-4 items-center px-6 py-3.5 hover:bg-muted/50 transition-colors cursor-pointer ${showLotGain ? 'grid-cols-[1fr_auto_auto_auto_auto_auto_auto_auto]' : 'grid-cols-[1fr_auto_auto_auto_auto_auto]'}`}
            >
              <span className="text-sm text-muted-foreground">{formatDate(tx.transactionDate)}</span>
              <span className="w-24">
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                  {TX_TYPE_LABELS[tx.transactionType] ?? tx.transactionType}
                </span>
              </span>
              <span className="text-sm font-medium text-foreground text-right w-28">
                {formatAmount(tx.amount, tx.currency)}
              </span>
              <span className="text-sm text-muted-foreground text-right w-20 font-mono">
                {formatQuantity(tx.quantity)}
              </span>
              {showLotGain && (
                <>
                  <span className="text-sm text-muted-foreground text-right w-28 font-mono">
                    {isBuy && tx.pricePerUnit ? formatCurrency(new Decimal(tx.pricePerUnit).toNumber()) : '—'}
                  </span>
                  <span className="text-sm text-muted-foreground text-right w-28 font-mono">
                    {isBuy ? formatCurrency(currentPriceEur!) : '—'}
                  </span>
                  <span className={`text-sm font-medium text-right w-28 ${lotGain !== null ? (lotPos ? 'text-sage' : 'text-terracotta') : 'text-muted-foreground'}`}>
                    {lotGain !== null ? formatCurrency(lotGain) : '—'}
                  </span>
                </>
              )}
              <div className="w-16 flex items-center justify-end gap-3" onClick={e => e.stopPropagation()}>
                <Link
                  href={editHref}
                  aria-label="Bewerken"
                  title="Bewerken"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Pencil size={15} />
                </Link>
                <form action={deleteTransactionAction}>
                  <input type="hidden" name="transactionId" value={tx.id} />
                  <input type="hidden" name="assetId" value={assetId} />
                  {redirectTo && <input type="hidden" name="redirectTo" value={redirectTo} />}
                  <button
                    type="submit"
                    aria-label="Verwijderen"
                    title="Verwijderen"
                    className="text-muted-foreground hover:text-terracotta transition-colors"
                    onClick={e => { if (!confirm('Transactie verwijderen?')) e.preventDefault() }}
                  >
                    <Trash2 size={15} />
                  </button>
                </form>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
