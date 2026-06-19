import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/db/supabase-server'
import { getAsset } from '@/lib/db/queries/assets'
import { getBrokers } from '@/lib/db/queries/brokers'
import { AssetForm } from '@/components/assets/AssetForm'
import { updateAssetAction } from '@/app/assets/actions'
import { Topbar } from '@/components/layout/Topbar'

export default async function EditAssetPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ from?: string }>
}) {
  const { id } = await params
  const { from } = await searchParams
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [asset, brokerList] = await Promise.all([
    getAsset(user!.id, id),
    getBrokers(user!.id),
  ])
  if (!asset) notFound()

  const backHref = from ?? `/assets/${id}`

  return (
    <>
      <Topbar />
      <main className="mx-auto max-w-[1200px] px-8 py-12">
        <div className="mb-8">
          <Link href={backHref} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← Terug naar {asset.name}
          </Link>
          <h1 className="mt-4 text-2xl font-semibold text-foreground">Bewerken</h1>
        </div>

        <div className="max-w-2xl rounded-3xl border border-border bg-card p-8">
          <AssetForm action={updateAssetAction} initialData={asset} assetId={asset.id} redirectTo={from} cancelHref={from ?? backHref} brokerList={brokerList} />
        </div>
      </main>
    </>
  )
}
