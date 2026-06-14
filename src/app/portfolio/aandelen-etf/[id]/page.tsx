import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/db/supabase-server'
import { getAssetWithCalculations } from '@/lib/db/queries/assets'
import { getTransactions } from '@/lib/db/queries/transactions'
import { getBrokers } from '@/lib/db/queries/brokers'
import { formatCurrency, formatPercent, formatQuantity } from '@/lib/utils/format'
import { calculateCostBasis } from '@/lib/finance'
import { Topbar } from '@/components/layout/Topbar'
import { KpiCard } from '@/components/ui/KpiCard'
import { TransactionList } from '@/components/assets/TransactionList'
import { DeleteAssetButton } from '@/components/portfolio/DeleteAssetButton'

export default async function AandeelDetailPage({
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

  const [result, txList, brokerList] = await Promise.all([
    getAssetWithCalculations(user!.id, id),
    getTransactions(user!.id, id),
    getBrokers(user!.id),
  ])

  if (!result || result.asset.assetType !== 'stock_etf') notFound()

  const { asset, calculations } = result
  const { currentValue, netDeposit, unrealizedGain, xirr, quantityHeld, fetchedPrice, priceCurrency, priceEur } = calculations

  // WAC via AVCO (correct bij deelverkopen)
  const wacPerUnit = calculateCostBasis(txList.map(t => ({
    transactionType: t.transactionType,
    amount: t.amount,
    quantity: t.quantity,
  })))
  const wac = wacPerUnit.gt(0) ? wacPerUnit.toNumber() : null

  const gainAccent = unrealizedGain.gt(0) ? 'positive' : unrealizedGain.lt(0) ? 'negative' : undefined

  const fmtPrice = (v: number) =>
    new Intl.NumberFormat('nl-NL', { style: 'currency', currency: priceCurrency ?? 'EUR' }).format(v)

  // Breadcrumb: vind broker op naam zodat we naar de broker-pagina kunnen linken
  const brokerName = asset.stockEtfDetails?.broker?.trim()
  const broker     = brokerName ? brokerList.find(b => b.name === brokerName) : undefined

  return (
    <>
      <Topbar />
      <main className="mx-auto max-w-[1200px] px-8 py-12 space-y-8">

        {/* Breadcrumb */}
        <div>
          <nav className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
            <Link href="/portfolio/aandelen-etf" className="hover:text-foreground transition-colors">
              Aandelen &amp; ETFs
            </Link>
            {broker && (
              <>
                <span>›</span>
                <Link
                  href={`/portfolio/aandelen-etf/broker/${broker.id}`}
                  className="hover:text-foreground transition-colors"
                >
                  {broker.name}
                </Link>
              </>
            )}
            <span>›</span>
            <span className="text-foreground font-medium">{asset.name}</span>
          </nav>
          <div className="mt-4 flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-foreground">{asset.name}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {asset.stockEtfDetails?.ticker ?? '—'}
                {asset.stockEtfDetails?.accountType ? ` · ${asset.stockEtfDetails.accountType}` : ''}
                {asset.stockEtfDetails?.isin ? ` · ${asset.stockEtfDetails.isin}` : ''}
              </p>
            </div>
            <Link
              href={`/assets/${asset.id}/edit?from=${from ?? `/portfolio/aandelen-etf/${asset.id}`}`}
              className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              Bewerken
            </Link>
          </div>
        </div>

        {/* Rij 1: portfolio-prestatie */}
        <div className="grid grid-cols-3 gap-4">
          <KpiCard
            label="Marktwaarde"
            value={currentValue.gt(0) ? formatCurrency(currentValue.toNumber()) : '—'}
            subtext={fetchedPrice ? `Koers: ${fmtPrice(fetchedPrice.toNumber())}` : undefined}
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
            label="Jaarrendement"
            value={xirr ? formatPercent(xirr.toNumber()) : '—'}
            subtext={xirr ? 'XIRR – gecorrigeerd voor instaptiming' : 'Beschikbaar na 30 dagen'}
            trend={xirr ? { value: '', positive: xirr.gt(0) } : undefined}
          />
        </div>

        {/* Rij 2: positie-details */}
        {quantityHeld && (
          <div className="grid grid-cols-3 gap-4">
            <KpiCard
              label="Aantal in bezit"
              value={formatQuantity(quantityHeld.toNumber())}
              subtext="Huidige positiegrootte"
            />
            <KpiCard
              label="Gem. aankoopkoers"
              value={wac ? formatCurrency(wac) : '—'}
              subtext="Gewogen gemiddelde (WAC)"
            />
            <KpiCard
              label="Huidige koers"
              value={priceEur ? formatCurrency(priceEur.toNumber()) : '—'}
              subtext={fetchedPrice && priceCurrency && priceCurrency !== 'EUR'
                ? `${fmtPrice(fetchedPrice.toNumber())} ${priceCurrency}`
                : 'Live marktkoers in EUR'}
            />
          </div>
        )}

        {/* Transacties */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Transacties</h2>
            <div className="flex gap-2">
              <Link
                href={`/assets/${asset.id}/transactions/new?from=/portfolio/aandelen-etf/${asset.id}`}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
              >
                + Kopen
              </Link>
              <Link
                href={`/assets/${asset.id}/transactions/new?from=/portfolio/aandelen-etf/${asset.id}&type=sell`}
                className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                Verkopen
              </Link>
            </div>
          </div>
          <TransactionList
            transactions={txList}
            assetId={asset.id}
            addHref={`/assets/${asset.id}/transactions/new?from=/portfolio/aandelen-etf/${asset.id}`}
            redirectTo={`/portfolio/aandelen-etf/${asset.id}`}
            currentPriceEur={priceEur?.toNumber()}
          />
        </div>

        <div className="flex justify-end pt-4">
          <DeleteAssetButton assetId={asset.id} assetName={asset.name} redirectTo="/portfolio/aandelen-etf" />
        </div>

      </main>
    </>
  )
}
