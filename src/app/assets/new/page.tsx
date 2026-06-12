import Link from 'next/link'
import { Topbar } from '@/components/layout/Topbar'
import { AssetForm } from '@/components/assets/AssetForm'
import { createAssetAction } from '@/app/assets/actions'

const TYPE_LABELS: Record<string, string> = {
  stock_etf:   'Aandeel / ETF',
  crypto:      'Crypto',
  savings:     'Spaarrekening',
  real_estate: 'Vastgoed',
  pension:     'Pensioen',
  vordering:   'Vordering',
}

const VALID_TYPES = new Set(['stock_etf', 'crypto', 'savings', 'real_estate', 'pension', 'vordering'])

export default async function NewAssetPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>
}) {
  const { type } = await searchParams
  const lockedType = type && VALID_TYPES.has(type) ? type : undefined
  const label = lockedType ? TYPE_LABELS[lockedType] : 'Asset'

  return (
    <>
      <Topbar />
      <main className="mx-auto max-w-[1200px] px-8 py-12">
        <div className="mb-8">
          <Link href="/assets" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← Terug naar beheer
          </Link>
          <h1 className="mt-4 text-2xl font-semibold text-foreground">Nieuw {label.toLowerCase()}</h1>
        </div>

        <div className="max-w-2xl rounded-3xl border border-border bg-card p-8">
          <AssetForm action={createAssetAction} lockedType={lockedType} />
        </div>
      </main>
    </>
  )
}
