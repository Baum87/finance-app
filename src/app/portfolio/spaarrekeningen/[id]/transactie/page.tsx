import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/db/supabase-server'
import { getAsset } from '@/lib/db/queries/assets'
import { Topbar } from '@/components/layout/Topbar'
import { SavingsTransactionForm } from '@/components/portfolio/SavingsTransactionForm'
import { createSavingsTransactionAction } from '@/app/portfolio/spaarrekeningen/actions'

export default async function SavingsTransactiePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  const asset = await getAsset(user!.id, id)
  if (!asset || asset.assetType !== 'savings') notFound()

  const redirectTo = `/portfolio/spaarrekeningen/${id}`
  const monthlyAmount = asset.savingsDetails?.monthlyDepositAmount ?? null

  return (
    <>
      <Topbar />
      <main className="mx-auto max-w-[1200px] px-8 py-12">
        <div className="mb-8">
          <Link
            href={redirectTo}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← {asset.name}
          </Link>
          <h1 className="mt-4 text-2xl font-semibold text-foreground">Storting / opname toevoegen</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {asset.savingsDetails?.bankName ?? asset.name}
          </p>
        </div>

        <div className="max-w-2xl rounded-3xl border border-border bg-card p-8">
          <SavingsTransactionForm
            action={createSavingsTransactionAction}
            assetId={asset.id}
            redirectTo={redirectTo}
            defaultMonthlyAmount={monthlyAmount}
          />
        </div>
      </main>
    </>
  )
}
