import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/db/supabase-server'
import { getCryptoWallets } from '@/lib/db/queries/assets'
import { Topbar } from '@/components/layout/Topbar'
import { AssetForm } from '@/components/assets/AssetForm'
import { createAssetAction } from '@/app/assets/actions'

export default async function NewCryptoPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  const walletList = await getCryptoWallets(user!.id)

  return (
    <>
      <Topbar />
      <main className="mx-auto max-w-[1200px] px-8 py-12">
        <div className="mb-8">
          <Link href="/portfolio/crypto" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← Crypto
          </Link>
          <h1 className="mt-4 text-2xl font-semibold text-foreground">Nieuwe crypto positie</h1>
        </div>
        <div className="max-w-2xl rounded-3xl border border-border bg-card p-8">
          <AssetForm
            action={createAssetAction}
            lockedType="crypto"
            redirectBase="/portfolio/crypto"
            cancelHref="/portfolio/crypto"
            walletList={walletList}
          />
        </div>
      </main>
    </>
  )
}
