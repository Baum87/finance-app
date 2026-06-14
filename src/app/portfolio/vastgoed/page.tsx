import Decimal from 'decimal.js'
import { createServerSupabaseClient } from '@/lib/db/supabase-server'
import { getAssetsWithValues, getMortgageBalancesMap } from '@/lib/db/queries/assets'
import { formatCurrency } from '@/lib/utils/format'
import { Topbar } from '@/components/layout/Topbar'
import { KpiCard } from '@/components/ui/KpiCard'
import { PortfolioTile } from '@/components/portfolio/PortfolioTile'

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  primary_residence: 'Eigen woning',
  rental:            'Verhuurpand',
  vacation:          'Vakantiewoning',
}

export default async function VastgoedPortfolioPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user!.id

  const [allAssets, mortgageMap] = await Promise.all([
    getAssetsWithValues(userId),
    getMortgageBalancesMap(userId),
  ])

  const assets = allAssets.filter(a => a.assetType === 'real_estate')

  const totaleWaarde = assets.reduce((s, a) => s.plus(a.currentValue), new Decimal(0))
  const totaleHypotheek = assets.reduce((s, a) => s.plus(mortgageMap.get(a.id) ?? new Decimal(0)), new Decimal(0))
  const totaalEigenVermogen = totaleWaarde.minus(totaleHypotheek)

  return (
    <>
      <Topbar />
      <main className="mx-auto max-w-[1200px] px-8 py-12 space-y-8">

        <div>
          <h1 className="text-2xl font-semibold text-foreground">Vastgoed</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {assets.length} pand{assets.length !== 1 ? 'en' : ''} · eigen woning, verhuur en vakantie
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <KpiCard
            label="Totale marktwaarde"
            value={totaleWaarde.gt(0) ? formatCurrency(totaleWaarde.toNumber()) : '—'}
            subtext="Geregistreerde waarderingen"
          />
          <KpiCard
            label="Totale hypotheekschuld"
            value={totaleHypotheek.gt(0) ? formatCurrency(totaleHypotheek.toNumber()) : '—'}
            subtext="Openstaand saldo"
          />
          <KpiCard
            label="Eigen vermogen vastgoed"
            value={totaleWaarde.gt(0) ? formatCurrency(totaalEigenVermogen.toNumber()) : '—'}
            subtext="Waarde min hypotheek"
            trend={totaleWaarde.gt(0) ? { value: '', positive: totaalEigenVermogen.gte(0) } : undefined}
          />
        </div>

        {assets.length > 0 ? (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-foreground">Panden</h2>
              <a
                href="/assets/new?type=real_estate&from=/portfolio/vastgoed"
                className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
              >
                + Nieuw vastgoed
              </a>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {assets.map(a => {
                const hypotheek = mortgageMap.get(a.id) ?? new Decimal(0)
                const eigenVermogen = a.currentValue.minus(hypotheek)
                return (
                  <PortfolioTile
                    key={a.id}
                    href={`/portfolio/vastgoed/${a.id}`}
                    name={a.name}
                    subtitle={a.realEstateDetails?.address ?? PROPERTY_TYPE_LABELS[a.realEstateDetails?.propertyType ?? ''] ?? '—'}
                    value={a.currentValue.toNumber()}
                    badge={PROPERTY_TYPE_LABELS[a.realEstateDetails?.propertyType ?? ''] ?? undefined}
                    footer={hypotheek.gt(0)
                      ? { label: 'Eigen vermogen', value: formatCurrency(eigenVermogen.toNumber()) }
                      : undefined}
                  />
                )
              })}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-12 text-center">
            <p className="text-sm text-muted-foreground mb-4">Nog geen vastgoed toegevoegd.</p>
            <a
              href="/assets/new?type=real_estate&from=/portfolio/vastgoed"
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
            >
              + Nieuw vastgoed
            </a>
          </div>
        )}

      </main>
    </>
  )
}
