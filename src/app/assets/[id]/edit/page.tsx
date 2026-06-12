import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/db/supabase-server'
import { getAsset } from '@/lib/db/queries/assets'
import { AssetForm } from '@/components/assets/AssetForm'
import { updateAssetAction } from '@/app/assets/actions'
import { Topbar } from '@/components/layout/Topbar'

export default async function EditAssetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  const asset = await getAsset(user!.id, id)
  if (!asset) notFound()

  return (
    <>
      <Topbar />
      <main className="mx-auto max-w-[1200px] px-8 py-12">
        <div className="mb-8">
          <Link href={`/assets/${id}`} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← Terug naar {asset.name}
          </Link>
          <h1 className="mt-4 text-2xl font-semibold text-foreground">Bewerken</h1>
        </div>

        <div className="max-w-2xl rounded-[24px] border border-border bg-card p-8">
          <AssetForm action={updateAssetAction} initialData={asset} assetId={asset.id} />
        </div>
      </main>
    </>
  )
}
