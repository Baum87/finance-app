import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/db/supabase-server'
import { getAssetsWithValues } from '@/lib/db/queries/assets'
import { getTransactionsByAssetsDetailed } from '@/lib/db/queries/transactions'
import { buildAnnualReturns } from '@/lib/finance/stock-series'
import { Topbar } from '@/components/layout/Topbar'
import { AnnualReturnChart } from '@/components/portfolio/AnnualReturnChart'

export default async function AandelenRendementPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  const allAssets = await getAssetsWithValues(user!.id)
  const assets = allAssets.filter(a => a.assetType === 'stock_etf')
  const assetIds = assets.map(a => a.id)
  const txs = assetIds.length > 0 ? await getTransactionsByAssetsDetailed(assetIds) : []

  const tickerByAssetId = new Map<string, string>()
  for (const a of assets) {
    const ticker = a.stockEtfDetails?.ticker
    if (ticker) tickerByAssetId.set(a.id, ticker)
  }

  const annualReturns = txs.length > 0 ? await buildAnnualReturns(txs, tickerByAssetId) : []

  return (
    <>
      <Topbar />
      <main className="mx-auto max-w-[1200px] px-8 py-12 space-y-8">

        <div>
          <Link href="/portfolio/aandelen-etf" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← Aandelen &amp; ETFs
          </Link>
          <h1 className="mt-4 text-2xl font-semibold text-foreground">Rendement per jaar</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Het werkelijke rendement per kalenderjaar — niet geannualiseerd, dus ook het
            lopende jaar telt mee zonder vertekening.
          </p>
        </div>

        {annualReturns.length > 0 ? (
          <AnnualReturnChart
            data={annualReturns.map(r => ({
              year: r.year,
              returnAmount: r.returnAmount.toNumber(),
              returnPct: r.returnPct ? r.returnPct.toNumber() : null,
            }))}
          />
        ) : (
          <div className="rounded-2xl border border-border bg-card p-12 text-center">
            <p className="text-sm text-muted-foreground">Nog geen transacties om een jaaroverzicht van te maken.</p>
          </div>
        )}

      </main>
    </>
  )
}
