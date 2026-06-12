import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/db/supabase-server'
import { getAssetsWithValues } from '@/lib/db/queries/assets'
import { AssetList } from '@/components/assets/AssetList'
import { Topbar } from '@/components/layout/Topbar'

export default async function AssetsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  const assets = await getAssetsWithValues(user!.id)

  return (
    <>
      <Topbar />
      <main className="mx-auto max-w-[1200px] px-8 py-12 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Portfolio</h1>
            <p className="mt-1 text-sm text-muted-foreground">{assets.length} asset{assets.length !== 1 ? 's' : ''}</p>
          </div>
          <Link
            href="/assets/new"
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
          >
            + Nieuw asset
          </Link>
        </div>

        <AssetList assets={assets} />
      </main>
    </>
  )
}
