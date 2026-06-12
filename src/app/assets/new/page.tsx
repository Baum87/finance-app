import Link from 'next/link'
import { Topbar } from '@/components/layout/Topbar'
import { AssetForm } from '@/components/assets/AssetForm'
import { createAssetAction } from '@/app/assets/actions'

export default function NewAssetPage() {
  return (
    <>
      <Topbar />
      <main className="mx-auto max-w-[1200px] px-8 py-12">
        <div className="mb-8">
          <Link href="/assets" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← Terug naar portfolio
          </Link>
          <h1 className="mt-4 text-2xl font-semibold text-foreground">Nieuw asset</h1>
        </div>

        <div className="max-w-2xl rounded-[24px] border border-border bg-card p-8">
          <AssetForm action={createAssetAction} />
        </div>
      </main>
    </>
  )
}
