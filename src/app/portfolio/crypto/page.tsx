import Decimal from 'decimal.js'
import { createServerSupabaseClient } from '@/lib/db/supabase-server'
import { getAssetsWithValues } from '@/lib/db/queries/assets'
import { getTransactionsByAssetsDetailed } from '@/lib/db/queries/transactions'
import { calculateNetDeposit } from '@/lib/finance'
import { formatCurrency, formatPercent } from '@/lib/utils/format'
import { Topbar } from '@/components/layout/Topbar'
import { KpiCard } from '@/components/ui/KpiCard'
import { PortfolioTile } from '@/components/portfolio/PortfolioTile'

export default async function CryptoPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user!.id

  const allAssets = await getAssetsWithValues(userId)
  const assets = allAssets.filter(a => a.assetType === 'crypto')
  const assetIds = assets.map(a => a.id)

  const allTxs = assetIds.length > 0 ? await getTransactionsByAssetsDetailed(assetIds) : []

  const totaleWaarde = assets.reduce((s, a) => s.plus(a.currentValue), new Decimal(0))

  const netDeposit = calculateNetDeposit(allTxs)
  const totaleWinst = totaleWaarde.minus(netDeposit)

  return (
    <>
      <Topbar />
      <main className="mx-auto max-w-[1200px] px-8 py-12 space-y-8">

        <div>
          <h1 className="text-2xl font-semibold text-foreground">Crypto</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {assets.length} positie{assets.length !== 1 ? 's' : ''} · cryptocurrency posities
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            label="Totale marktwaarde"
            value={formatCurrency(totaleWaarde.toNumber())}
            subtext="Live koersen"
          />
          <KpiCard
            label="Totale inleg"
            value={formatCurrency(netDeposit.toNumber())}
            subtext="Koop min verkoop"
          />
          <KpiCard
            label="Rendement (totaal)"
            value={netDeposit.gt(0) ? formatCurrency(totaleWinst.toNumber()) : '—'}
            subtext={netDeposit.gt(0)
              ? `${formatPercent(totaleWinst.div(netDeposit).toNumber())} op inleg`
              : undefined}
            trend={netDeposit.gt(0) ? { value: '', positive: totaleWinst.gte(0) } : undefined}
          />
          <KpiCard
            label="Posities"
            value={String(assets.length)}
            subtext="Actieve posities"
          />
        </div>

        {assets.length > 0 ? (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-foreground">Posities</h2>
              <a
                href="/assets/new?type=crypto&from=/portfolio/crypto"
                className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
              >
                + Nieuwe crypto
              </a>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {assets.map(a => (
                <PortfolioTile
                  key={a.id}
                  href={`/portfolio/crypto/${a.id}`}
                  name={a.name}
                  subtitle={a.cryptoDetails?.walletOrExchange ?? 'Onbekende exchange'}
                  value={a.currentValue.toNumber()}
                  badge={a.cryptoDetails?.ticker ?? undefined}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-12 text-center">
            <p className="text-sm text-muted-foreground mb-4">Nog geen crypto posities toegevoegd.</p>
            <a
              href="/assets/new?type=crypto&from=/portfolio/crypto"
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
            >
              + Nieuwe crypto
            </a>
          </div>
        )}

      </main>
    </>
  )
}
