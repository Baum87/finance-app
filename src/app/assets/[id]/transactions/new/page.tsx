import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/db/supabase-server'
import { getAsset } from '@/lib/db/queries/assets'
import { getTransactions } from '@/lib/db/queries/transactions'
import { calculateCostBasis, calculateQuantityHeld } from '@/lib/finance'
import { BuyTransactionForm } from '@/components/assets/BuyTransactionForm'
import { SellTransactionForm } from '@/components/assets/SellTransactionForm'
import { TransactionForm } from '@/components/assets/TransactionForm'
import { createTransactionAction } from '@/app/assets/actions'
import { Topbar } from '@/components/layout/Topbar'

type Mode = 'buy' | 'sell' | 'other'

export default async function NewTransactionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ from?: string; type?: string }>
}) {
  const { id } = await params
  const { from, type } = await searchParams
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  const asset = await getAsset(user!.id, id)
  if (!asset) notFound()

  const ticker = asset.stockEtfDetails?.ticker ?? null
  const isStockEtf = asset.assetType === 'stock_etf' && !!ticker

  const mode: Mode = isStockEtf
    ? (type === 'sell' ? 'sell' : type === 'other' ? 'other' : 'buy')
    : 'other'

  // For stock_etf, fetch transactions to calculate quantity and WAC
  let quantityHeld = 0
  let wac: number | null = null
  if (isStockEtf) {
    const txs = await getTransactions(user!.id, id)
    const txInputs = txs.map(t => ({
      transactionType: t.transactionType,
      amount: t.amount,
      quantity: t.quantity,
      fees: t.fees ?? '0',
    }))
    quantityHeld = calculateQuantityHeld(txInputs).toNumber()
    const wacDecimal = calculateCostBasis(txInputs)
    wac = wacDecimal.gt(0) ? wacDecimal.toNumber() : null
  }

  const backHref = from ?? `/assets/${id}`
  const fromParam = encodeURIComponent(from ?? '')

  const titles: Record<Mode, string> = {
    buy:   'Aankoop vastleggen',
    sell:  'Verkoop vastleggen',
    other: 'Transactie toevoegen',
  }

  return (
    <>
      <Topbar />
      <main className="mx-auto max-w-[1200px] px-8 py-12">
        <div className="mb-8">
          <Link href={backHref} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← Terug naar {asset.name}
          </Link>
          <div className="mt-4 flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-foreground">{titles[mode]}</h1>
            {ticker && (
              <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                {ticker}
              </span>
            )}
          </div>
        </div>

        <div className="max-w-2xl space-y-4">

          {/* Buy / Sell tabs voor stock_etf */}
          {isStockEtf && mode !== 'other' && (
            <div className="flex gap-1 p-1 bg-muted rounded-xl w-fit">
              <Link
                href={`/assets/${id}/transactions/new?from=${fromParam}`}
                className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
                  mode === 'buy'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Aankoop
              </Link>
              <Link
                href={`/assets/${id}/transactions/new?from=${fromParam}&type=sell`}
                className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
                  mode === 'sell'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Verkoop
              </Link>
            </div>
          )}

          <div className="rounded-2xl border border-border bg-card p-8">
            {mode === 'buy' && (
              <BuyTransactionForm
                action={createTransactionAction}
                assetId={asset.id}
                ticker={ticker!}
                redirectTo={from}
                cancelHref={backHref}
              />
            )}
            {mode === 'sell' && (
              <SellTransactionForm
                action={createTransactionAction}
                assetId={asset.id}
                ticker={ticker!}
                quantityHeld={quantityHeld}
                wac={wac}
                redirectTo={from}
                cancelHref={backHref}
              />
            )}
            {mode === 'other' && (
              <TransactionForm
                action={createTransactionAction}
                assetId={asset.id}
                redirectTo={from}
                cancelHref={backHref}
                allowedTypes={isStockEtf ? ['dividend', 'cost'] : undefined}
              />
            )}
          </div>

          {/* Link naar overige transacties */}
          {isStockEtf && mode !== 'other' && (
            <p className="text-sm text-center text-muted-foreground">
              <Link
                href={`/assets/${id}/transactions/new?from=${fromParam}&type=other`}
                className="hover:text-foreground transition-colors underline underline-offset-2"
              >
                Andere transactie (dividend, kosten, splits…)
              </Link>
            </p>
          )}
          {isStockEtf && mode === 'other' && (
            <p className="text-sm text-center text-muted-foreground">
              <Link
                href={`/assets/${id}/transactions/new?from=${fromParam}`}
                className="hover:text-foreground transition-colors underline underline-offset-2"
              >
                ← Terug naar aankoop / verkoop
              </Link>
            </p>
          )}

        </div>
      </main>
    </>
  )
}
