import Decimal from 'decimal.js'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/db/supabase-server'
import { getAssetsWithValues } from '@/lib/db/queries/assets'
import { getTransactionsByAssetsDetailed } from '@/lib/db/queries/transactions'
import { getBrokers } from '@/lib/db/queries/brokers'
import { formatCurrency, formatPercent } from '@/lib/utils/format'
import { Topbar } from '@/components/layout/Topbar'
import { KpiCard } from '@/components/ui/KpiCard'
import { DeleteBrokerButton } from '@/components/portfolio/DeleteBrokerButton'
import { BrokerPositionsTable } from '@/components/portfolio/BrokerPositionsTable'

export default async function BrokerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [allAssets, brokerList] = await Promise.all([
    getAssetsWithValues(user!.id),
    getBrokers(user!.id),
  ])

  const broker = brokerList.find(b => b.id === id)
  if (!broker) notFound()

  const assets = allAssets.filter(
    a => a.assetType === 'stock_etf' && a.stockEtfDetails?.brokerId === broker.id,
  )

  const assetIds = assets.map(a => a.id)
  const detailedTxs = assetIds.length > 0 ? await getTransactionsByAssetsDetailed(assetIds) : []

  // ─── KPI's — netto inleg (buys − sell-opbrengsten) ───────────────────────────

  const totaleWaarde = assets.reduce((s, a) => s.plus(a.currentValue), new Decimal(0))

  const nettoInlegByAsset = new Map<string, Decimal>()
  for (const tx of detailedTxs) {
    const prev = nettoInlegByAsset.get(tx.assetId) ?? new Decimal(0)
    if (tx.transactionType === 'buy')  nettoInlegByAsset.set(tx.assetId, prev.plus(tx.amount))
    if (tx.transactionType === 'sell') nettoInlegByAsset.set(tx.assetId, prev.minus(tx.amount))
  }

  const nettoInleg   = assets.reduce((s, a) => s.plus(nettoInlegByAsset.get(a.id) ?? 0), new Decimal(0))
  const winstVerlies = totaleWaarde.minus(nettoInleg)
  const winstPct     = nettoInleg.gt(0) ? winstVerlies.div(nettoInleg) : null
  const isPositive   = winstVerlies.gte(0)

  const backTo = `/portfolio/aandelen-etf/broker/${id}`

  return (
    <>
      <Topbar />
      <main className="mx-auto max-w-[1200px] px-8 py-12 space-y-8">

        {/* Breadcrumb */}
        <div>
          <nav className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/portfolio/aandelen-etf" className="hover:text-foreground transition-colors">
              Aandelen &amp; ETFs
            </Link>
            <span>›</span>
            <span className="text-foreground font-medium">{broker.name}</span>
          </nav>
          <div className="mt-4 flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-foreground">{broker.name}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {assets.length} positie{assets.length !== 1 ? 's' : ''}
              </p>
            </div>
            <Link
              href={`/assets/new?type=stock_etf&from=/portfolio/aandelen-etf&cancel=${backTo}&brokerId=${broker.id}`}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
            >
              + Nieuwe positie
            </Link>
          </div>
        </div>

        {/* 3 KPI-tegels */}
        <div className="grid grid-cols-3 gap-4">
          <KpiCard
            label="Marktwaarde"
            value={totaleWaarde.gt(0) ? formatCurrency(totaleWaarde.toNumber()) : '—'}
            subtext="Live koersen"
          />
          <KpiCard
            label="Winst / verlies"
            value={nettoInleg.gt(0) ? formatCurrency(winstVerlies.toNumber()) : '—'}
            subtext={winstPct ? formatPercent(winstPct.toNumber()) : undefined}
            trend={nettoInleg.gt(0) ? { value: '', positive: isPositive } : undefined}
          />
          <KpiCard
            label="Rendement"
            value={winstPct ? formatPercent(winstPct.toNumber()) : '—'}
            subtext="Op netto inleg"
            trend={winstPct ? { value: '', positive: isPositive } : undefined}
          />
        </div>

        {/* Posities */}
        {assets.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-10 text-center">
            <p className="text-sm text-muted-foreground mb-4">Nog geen posities bij deze broker.</p>
            <Link
              href={`/assets/new?type=stock_etf&from=/portfolio/aandelen-etf&cancel=${backTo}&brokerId=${broker.id}`}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
            >
              + Nieuwe positie
            </Link>
          </div>
        ) : (
          <BrokerPositionsTable
            rows={assets.map(a => {
              const assetInleg    = nettoInlegByAsset.get(a.id) ?? new Decimal(0)
              const assetWv       = a.currentValue.minus(assetInleg)
              const assetWvPct    = assetInleg.gt(0) ? assetWv.div(assetInleg).toNumber() : null
              return {
                id:             a.id,
                name:           a.name,
                ticker:         a.stockEtfDetails?.ticker ?? null,
                sector:         a.stockEtfDetails?.sector ?? null,
                instrumentType: a.stockEtfDetails?.instrumentType ?? null,
                currentValue:   a.currentValue.toNumber(),
                inleg:          assetInleg.toNumber(),
                winstVerlies:   assetWv.toNumber(),
                winstPct:       assetWvPct,
              }
            })}
            backTo={backTo}
          />
        )}

        <div className="flex justify-end pt-4">
          <DeleteBrokerButton brokerId={broker.id} brokerName={broker.name} />
        </div>

      </main>
    </>
  )
}
