import Decimal from 'decimal.js'
import { createServerSupabaseClient } from '@/lib/db/supabase-server'
import { getAssetsWithValues } from '@/lib/db/queries/assets'
import { formatCurrency } from '@/lib/utils/format'
import { Topbar } from '@/components/layout/Topbar'
import { KpiCard } from '@/components/ui/KpiCard'
import { PortfolioTile } from '@/components/portfolio/PortfolioTile'

const PENSION_TYPE_LABELS: Record<string, string> = {
  defined_benefit:      'Defined benefit',
  defined_contribution: 'Defined contribution',
  annuity:              'Lijfrente',
}

export default async function PensioenPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user!.id

  const allAssets = await getAssetsWithValues(userId)
  const assets = allAssets.filter(a => a.assetType === 'pension')

  const totaleWaarde = assets.reduce((s, a) => s.plus(a.currentValue), new Decimal(0))

  const totaleJaaruitkering = assets.reduce((s, a) => {
    const benefit = a.pensionDetails?.projectedAnnualBenefit
    return benefit ? s.plus(new Decimal(benefit)) : s
  }, new Decimal(0))

  return (
    <>
      <Topbar />
      <main className="mx-auto max-w-[1200px] px-8 py-12 space-y-8">

        <div>
          <h1 className="text-2xl font-semibold text-foreground">Pensioen</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {assets.length} regeling{assets.length !== 1 ? 'en' : ''} · werkgever, lijfrente en overig
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <KpiCard
            label="Totale opgebouwde waarde"
            value={totaleWaarde.gt(0) ? formatCurrency(totaleWaarde.toNumber()) : '—'}
            subtext="Geregistreerde waarderingen"
          />
          <KpiCard
            label="Verwachte jaaruitkering"
            value={totaleJaaruitkering.gt(0) ? formatCurrency(totaleJaaruitkering.toNumber()) : '—'}
            subtext="Bruto per jaar bij pensionering"
          />
          <KpiCard
            label="Regelingen"
            value={String(assets.length)}
            subtext="Actieve pensioenregelingen"
          />
        </div>

        {assets.length > 0 ? (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-foreground">Regelingen</h2>
              <a
                href="/assets/new?type=pension&from=/portfolio/pensioen"
                className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
              >
                + Nieuw pensioen
              </a>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {assets.map(a => {
                const benefit = a.pensionDetails?.projectedAnnualBenefit
                return (
                  <PortfolioTile
                    key={a.id}
                    href={`/portfolio/pensioen/${a.id}`}
                    name={a.name}
                    subtitle={a.pensionDetails?.provider ?? '—'}
                    value={a.currentValue.toNumber()}
                    badge={PENSION_TYPE_LABELS[a.pensionDetails?.pensionType ?? ''] ?? undefined}
                    footer={benefit
                      ? { label: 'Jaaruitkering', value: formatCurrency(Number(benefit)) }
                      : undefined}
                  />
                )
              })}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-12 text-center">
            <p className="text-sm text-muted-foreground mb-4">Nog geen pensioenregelingen toegevoegd.</p>
            <a
              href="/assets/new?type=pension&from=/portfolio/pensioen"
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
            >
              + Nieuw pensioen
            </a>
          </div>
        )}

      </main>
    </>
  )
}
