import Decimal from 'decimal.js'
import { createServerSupabaseClient } from '@/lib/db/supabase-server'
import { getAssetsWithValues } from '@/lib/db/queries/assets'
import { getTransactionsByAssets } from '@/lib/db/queries/transactions'
import { formatCurrency } from '@/lib/utils/format'
import { Topbar } from '@/components/layout/Topbar'
import { KpiCard } from '@/components/ui/KpiCard'
import { PortfolioTile } from '@/components/portfolio/PortfolioTile'

const LOAN_TYPE_LABELS: Record<string, string> = {
  family:   'Familie',
  business: 'Zakelijk',
  other:    'Overig',
}

export default async function VorderingenPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user!.id

  const allAssets = await getAssetsWithValues(userId)
  const assets = allAssets.filter(a => a.assetType === 'vordering')
  const assetIds = assets.map(a => a.id)

  const allTxs = assetIds.length > 0 ? await getTransactionsByAssets(userId, assetIds) : []

  const totaalUitstaand = assets.reduce((s, a) => s.plus(a.currentValue), new Decimal(0))

  const totaalRente = allTxs
    .filter(t => t.transactionType === 'interest')
    .reduce((s, t) => s.plus(new Decimal(t.amount)), new Decimal(0))

  return (
    <>
      <Topbar />
      <main className="mx-auto max-w-[1200px] px-8 py-12 space-y-8">

        <div>
          <h1 className="text-2xl font-semibold text-foreground">Vorderingen</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {assets.length} vordering{assets.length !== 1 ? 'en' : ''} · familie- en zakelijke leningen
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <KpiCard
            label="Totaal uitstaand"
            value={formatCurrency(totaalUitstaand.toNumber())}
            subtext="Openstaande vorderingen"
          />
          <KpiCard
            label="Rente ontvangen"
            value={formatCurrency(totaalRente.toNumber())}
            subtext="Totaal bijgeschreven"
            trend={totaalRente.gt(0) ? { value: '', positive: true } : undefined}
          />
          <KpiCard
            label="Vorderingen"
            value={String(assets.length)}
            subtext="Actieve vorderingen"
          />
        </div>

        {assets.length > 0 ? (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-foreground">Vorderingen</h2>
              <a
                href="/assets/new?type=vordering&from=/portfolio/vorderingen"
                className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
              >
                + Nieuwe vordering
              </a>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {assets.map(a => {
                const d = a.vorderingDetails
                const rente = d?.interestRate ? `${new Decimal(d.interestRate)}%` : null
                return (
                  <PortfolioTile
                    key={a.id}
                    href={`/portfolio/vorderingen/${a.id}`}
                    name={a.name}
                    subtitle={d?.counterparty ?? '—'}
                    value={a.currentValue.toNumber()}
                    badge={LOAN_TYPE_LABELS[d?.loanType ?? ''] ?? undefined}
                    footer={rente ? { label: 'Rente', value: rente } : undefined}
                  />
                )
              })}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-12 text-center">
            <p className="text-sm text-muted-foreground mb-4">Nog geen vorderingen toegevoegd.</p>
            <a
              href="/assets/new?type=vordering&from=/portfolio/vorderingen"
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
            >
              + Nieuwe vordering
            </a>
          </div>
        )}

      </main>
    </>
  )
}
