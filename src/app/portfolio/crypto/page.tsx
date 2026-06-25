import Decimal from 'decimal.js'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/db/supabase-server'
import { getAssetsWithValues } from '@/lib/db/queries/assets'
import { getTransactionsByAssetsDetailed } from '@/lib/db/queries/transactions'
import { calculateNetDeposit } from '@/lib/finance'
import { formatCurrency, formatPercent } from '@/lib/utils/format'
import { Topbar } from '@/components/layout/Topbar'
import { KpiCard } from '@/components/ui/KpiCard'

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
  const rendement = netDeposit.gt(0) ? totaleWinst.div(netDeposit) : null

  // Per-asset netDeposit voor tabelweergave
  const netDepositByAsset = new Map<string, Decimal>()
  for (const a of assets) {
    const assetTxs = allTxs.filter(t => t.assetId === a.id)
    netDepositByAsset.set(a.id, calculateNetDeposit(assetTxs))
  }

  // Groepering per wallet / exchange
  const groupMap = new Map<string, typeof assets>()
  for (const a of assets) {
    const key = a.cryptoDetails?.walletOrExchange || 'Overig'
    if (!groupMap.has(key)) groupMap.set(key, [])
    groupMap.get(key)!.push(a)
  }

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
            label="Marktwaarde"
            value={formatCurrency(totaleWaarde.toNumber())}
            subtext="Live koersen"
          />
          <KpiCard
            label="Netto inleg"
            value={formatCurrency(netDeposit.toNumber())}
            subtext="Aankopen minus verkopen"
          />
          <KpiCard
            label="Winst / verlies"
            value={netDeposit.gt(0) ? formatCurrency(totaleWinst.toNumber()) : '—'}
            subtext={rendement ? formatPercent(rendement.toNumber()) : undefined}
            trend={netDeposit.gt(0) ? { value: '', positive: totaleWinst.gte(0) } : undefined}
          />
          <KpiCard
            label="Rendement"
            value={rendement ? formatPercent(rendement.toNumber()) : '—'}
            subtext="Op netto inleg"
            trend={rendement ? { value: '', positive: totaleWinst.gte(0) } : undefined}
          />
        </div>

        {assets.length > 0 ? (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-foreground">Crypto posities</h2>
              <Link
                href="/assets/new?type=crypto&from=/portfolio/crypto"
                className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
              >
                + Nieuwe crypto
              </Link>
            </div>
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              <div className="hidden md:grid grid-cols-[1fr_auto_auto_auto_auto] gap-6 px-6 py-2.5 border-b border-border bg-muted/30">
                <span className="text-xs text-muted-foreground">Asset</span>
                <span className="text-xs text-muted-foreground text-right w-28">Waarde</span>
                <span className="text-xs text-muted-foreground text-right w-28">Netto inleg</span>
                <span className="text-xs text-muted-foreground text-right w-28">W/V</span>
                <span className="text-xs text-muted-foreground text-right w-20">%</span>
              </div>
              {[...groupMap.entries()].map(([group, groupAssets]) => {
                return (
                  <div key={group}>
                    <div className="px-6 py-2 bg-muted/20 border-t border-border">
                      <span className="text-xs font-medium text-muted-foreground">{group}</span>
                    </div>
                    <div className="divide-y divide-border">
                      {groupAssets.map(a => {
                        const nd = netDepositByAsset.get(a.id) ?? new Decimal(0)
                        const wv = a.currentValue.minus(nd)
                        const pct = nd.gt(0) ? wv.div(nd) : null
                        return (
                          <Link
                            key={a.id}
                            href={`/portfolio/crypto/${a.id}`}
                            className="grid grid-cols-[1fr_auto] md:grid-cols-[1fr_auto_auto_auto_auto] gap-6 items-center px-6 py-4 hover:bg-muted/50 transition-colors"
                          >
                            <div>
                              <p className="text-sm font-medium text-foreground">{a.name}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{a.cryptoDetails?.ticker ?? '—'}</p>
                            </div>
                            <span className="text-sm font-semibold text-foreground text-right w-28">
                              {formatCurrency(a.currentValue.toNumber())}
                            </span>
                            <span className="text-sm text-muted-foreground text-right w-28 hidden md:block">
                              {nd.gt(0) ? formatCurrency(nd.toNumber()) : '—'}
                            </span>
                            <span className={`text-sm font-medium text-right w-28 hidden md:block ${nd.gt(0) ? (wv.gte(0) ? 'text-sage' : 'text-terracotta') : 'text-muted-foreground'}`}>
                              {nd.gt(0) ? formatCurrency(wv.toNumber()) : '—'}
                            </span>
                            <span className={`text-sm font-medium text-right w-20 hidden md:block ${pct ? (pct.gte(0) ? 'text-sage' : 'text-terracotta') : 'text-muted-foreground'}`}>
                              {pct ? formatPercent(pct.toNumber()) : '—'}
                            </span>
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-12 text-center">
            <p className="text-sm text-muted-foreground mb-4">Nog geen crypto posities toegevoegd.</p>
            <Link
              href="/assets/new?type=crypto&from=/portfolio/crypto"
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
            >
              + Nieuwe crypto
            </Link>
          </div>
        )}

      </main>
    </>
  )
}
