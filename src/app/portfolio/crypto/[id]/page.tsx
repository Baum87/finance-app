import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/db/supabase-server'
import { getAssetWithCalculations } from '@/lib/db/queries/assets'
import { getTransactions } from '@/lib/db/queries/transactions'
import { formatCurrency, formatPercent } from '@/lib/utils/format'
import { Topbar } from '@/components/layout/Topbar'
import { KpiCard } from '@/components/ui/KpiCard'
import { TransactionList } from '@/components/assets/TransactionList'
import { DeleteAssetButton } from '@/components/portfolio/DeleteAssetButton'

export default async function CryptoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [result, txList] = await Promise.all([
    getAssetWithCalculations(user!.id, id),
    getTransactions(user!.id, id),
  ])

  if (!result || result.asset.assetType !== 'crypto') notFound()

  const { asset, calculations } = result
  const { currentValue, netDeposit, unrealizedGain, xirr, quantityHeld, priceEur } = calculations

  const gainAccent = unrealizedGain.gt(0) ? 'positive' : unrealizedGain.lt(0) ? 'negative' : undefined

  const fmtKoers = (v: number) =>
    new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(v)

  return (
    <>
      <Topbar />
      <main className="mx-auto max-w-[1200px] px-8 py-12 space-y-8">

        <div>
          <Link
            href="/portfolio/crypto"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Crypto
          </Link>
          <div className="mt-4 flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-foreground">{asset.name}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {asset.cryptoDetails?.ticker ?? '—'}
                {asset.cryptoDetails?.walletOrExchange ? ` · ${asset.cryptoDetails.walletOrExchange}` : ''}
              </p>
            </div>
            <Link
              href={`/assets/${asset.id}/edit?from=/portfolio/crypto/${asset.id}`}
              className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              Bewerken
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            label="Marktwaarde"
            value={currentValue.gt(0) ? formatCurrency(currentValue.toNumber()) : '—'}
            subtext={priceEur ? `Koers: ${fmtKoers(priceEur.toNumber())}` : undefined}
          />
          <KpiCard
            label="Totale inleg"
            value={formatCurrency(netDeposit.toNumber())}
            subtext="Koop min verkoop"
          />
          <KpiCard
            label="Winst / verlies"
            value={currentValue.gt(0) ? formatCurrency(unrealizedGain.toNumber()) : '—'}
            subtext={currentValue.gt(0) && netDeposit.gt(0)
              ? formatPercent(unrealizedGain.div(netDeposit).toNumber())
              : undefined}
            trend={gainAccent ? { value: '', positive: gainAccent === 'positive' } : undefined}
          />
          <KpiCard
            label="Rendement"
            value={xirr ? formatPercent(xirr.toNumber()) : '—'}
            subtext={xirr ? 'Jaarlijks, berekend via XIRR' : 'Te weinig data'}
            trend={xirr ? { value: '', positive: xirr.gt(0) } : undefined}
          />
        </div>

        {quantityHeld && (
          <div className="grid grid-cols-2 gap-4">
            <KpiCard
              label="Hoeveelheid"
              value={quantityHeld.toFixed(8).replace(/\.?0+$/, '')}
              subtext={asset.cryptoDetails?.ticker ?? undefined}
            />
            <KpiCard
              label="Transacties"
              value={String(txList.length)}
              subtext="Totaal geregistreerd"
            />
          </div>
        )}

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Transacties</h2>
            <Link
              href={`/assets/${asset.id}/transactions/new?from=/portfolio/crypto/${asset.id}`}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
            >
              + Transactie
            </Link>
          </div>
          <TransactionList
            transactions={txList}
            assetId={asset.id}
            addHref={`/assets/${asset.id}/transactions/new?from=/portfolio/crypto/${asset.id}`}
            redirectTo={`/portfolio/crypto/${asset.id}`}
          />
        </div>

        <div className="flex justify-end pt-4">
          <DeleteAssetButton assetId={asset.id} assetName={asset.name} redirectTo="/portfolio/crypto" />
        </div>

      </main>
    </>
  )
}
