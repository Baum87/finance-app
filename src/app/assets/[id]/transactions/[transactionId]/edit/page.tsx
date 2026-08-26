import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/db/supabase-server'
import { getAsset } from '@/lib/db/queries/assets'
import { getTransactionById } from '@/lib/db/queries/transactions'
import { TransactionForm } from '@/components/assets/TransactionForm'
import { updateTransactionAction } from '@/app/assets/actions'
import { Topbar } from '@/components/layout/Topbar'
import type { TransactionType } from '@/types'

const ALLOWED_TYPES: Record<string, TransactionType[]> = {
  stock_etf:   ['buy', 'sell', 'dividend', 'cost'],
  crypto:      ['buy', 'sell'],
  savings:     ['deposit', 'withdrawal', 'interest'],
  real_estate: ['buy', 'sell', 'rental_income', 'cost'],
  pension:     ['deposit'],
  vordering:   ['deposit', 'withdrawal', 'interest'],
}

export default async function EditTransactionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; transactionId: string }>
  searchParams: Promise<{ from?: string }>
}) {
  const { id, transactionId } = await params
  const { from } = await searchParams
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [asset, transaction] = await Promise.all([
    getAsset(user!.id, id),
    getTransactionById(user!.id, transactionId),
  ])

  if (!asset || !transaction) notFound()

  const backHref = from ?? `/assets/${id}`

  return (
    <>
      <Topbar />
      <main className="mx-auto max-w-[1200px] px-8 py-12">
        <div className="mb-8">
          <Link href={backHref} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← Terug
          </Link>
          <h1 className="mt-4 text-2xl font-semibold text-foreground">Transactie bewerken</h1>
        </div>
        <div className="max-w-2xl">
          <div className="rounded-2xl border border-border bg-card p-8">
            <TransactionForm
              action={updateTransactionAction}
              assetId={id}
              assetType={asset.assetType}
              transactionId={transactionId}
              initialData={transaction}
              redirectTo={backHref}
              cancelHref={backHref}
              allowedTypes={ALLOWED_TYPES[asset.assetType]}
            />
          </div>
        </div>
      </main>
    </>
  )
}
