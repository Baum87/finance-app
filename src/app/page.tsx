import Decimal from 'decimal.js'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/db/supabase-server'
import { getAssetsWithValues, getMortgageBalancesMap } from '@/lib/db/queries/assets'
import { getNetWorthAtDate } from '@/lib/db/queries/cashflow'
import { calculateNetWorth, calculateAllocation } from '@/lib/finance'
import { formatCurrency } from '@/lib/utils/format'
import { Topbar } from '@/components/layout/Topbar'

const ASSET_TYPE_LABELS: Record<string, string> = {
  stock_etf:   'Aandelen & ETF',
  crypto:      'Crypto',
  savings:     'Spaargeld',
  real_estate: 'Vastgoed',
  pension:     'Pensioen',
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Goedemorgen'
  if (hour < 18) return 'Goedemiddag'
  return 'Goedenavond'
}

export default async function OverzichtPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  const monthAgoDate = new Date()
  monthAgoDate.setDate(monthAgoDate.getDate() - 30)
  const monthAgoStr = monthAgoDate.toISOString().slice(0, 10)

  const [assets, mortgageMap, netWorthMonthAgo] = await Promise.all([
    getAssetsWithValues(user!.id),
    getMortgageBalancesMap(user!.id),
    getNetWorthAtDate(user!.id, monthAgoStr),
  ])

  const netWorth = calculateNetWorth(
    assets.map(a => ({
      value: a.currentValue,
      liability: mortgageMap.get(a.id) ?? new Decimal(0),
    })),
  )

  const delta = netWorthMonthAgo != null ? netWorth.minus(netWorthMonthAgo) : null
  const deltaPositive = delta?.gte(0) ?? true
  const deltaStr = delta
    ? `${deltaPositive ? '+' : ''}${formatCurrency(delta.toNumber())}`
    : null

  const allocationSlices = calculateAllocation(
    assets.map(a => ({ assetType: a.assetType, value: a.currentValue })),
  )
  const biggest = allocationSlices.sort((x, y) => y.value.minus(x.value).toNumber())[0]
  const biggestLabel  = biggest ? (ASSET_TYPE_LABELS[biggest.assetType] ?? biggest.assetType) : null
  const biggestPct    = biggest ? biggest.percentage.toNumber().toFixed(0) : null

  const firstName =
    (user?.user_metadata?.full_name as string | undefined)?.split(' ')[0]
    ?? user?.email?.split('@')[0]
    ?? ''

  return (
    <>
      <Topbar />
      <main className="mx-auto max-w-[1200px] px-8 py-12 space-y-6">

        {/* Blok 1 — Hero */}
        <section className="py-4">
          <h1 className="text-4xl font-semibold text-foreground leading-tight">
            {getGreeting()}{firstName ? `, ${firstName}` : ''}
          </h1>
          <p className="mt-2 text-lg font-light text-muted-foreground">
            Jouw financiële overzicht van vandaag.
          </p>
        </section>

        {/* Blok 2 — Inzichtkaart */}
        <div className="bg-card border border-border rounded-3xl p-6 space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">Netto vermogen</p>
            <p className="mt-1 text-3xl font-semibold text-foreground">
              {netWorth.gt(0) ? formatCurrency(netWorth.toNumber()) : '—'}
            </p>
            {deltaStr && (
              <p className={`mt-0.5 text-sm font-medium ${deltaPositive ? 'text-sage' : 'text-terracotta'}`}>
                {deltaStr} afgelopen 30 dagen
              </p>
            )}
          </div>

          {assets.length > 0 && (
            <ul className="space-y-1 text-sm text-foreground">
              {biggestLabel && biggestPct && (
                <li className="before:content-['•'] before:mr-2 before:text-muted-foreground">
                  Grootste positie: {biggestLabel} ({biggestPct}% van je vermogen)
                </li>
              )}
              {delta != null && (
                <li className="before:content-['•'] before:mr-2 before:text-muted-foreground">
                  Vermogen {deltaPositive ? 'gegroeid' : 'gedaald'} t.o.v. 30 dagen geleden
                </li>
              )}
              {assets.length === 0 && (
                <li className="text-muted-foreground italic">Voeg assets en waarderingen toe om inzichten te zien.</li>
              )}
            </ul>
          )}

          <div className="flex justify-end">
            <Link
              href="/cashflow"
              className="text-sm text-muted-foreground border border-border rounded-lg px-3 py-1.5 hover:bg-muted transition-colors"
            >
              Bekijk details →
            </Link>
          </div>
        </div>

        {/* Blok 3 — Actief doel (placeholder — doelen-datamodel volgt in Sprint 4) */}
        <div className="bg-card border border-border rounded-3xl p-6">
          <p className="text-sm font-medium text-muted-foreground">Actief doel</p>
          <p className="mt-3 text-foreground text-sm">Geen actief doel ingesteld.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Stel hier een spaardoel of vermogensdoel in. Beschikbaar in Sprint 4.
          </p>
        </div>

        {/* Blok 4 — AI Coach */}
        <div className="bg-card border border-border rounded-3xl p-6">
          <p className="text-sm font-medium text-muted-foreground">AI Coach</p>
          <p className="mt-3 text-foreground text-sm">Komt in een volgende versie.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Straks kun je hier vragen stellen over je financiën.
          </p>
        </div>

      </main>
    </>
  )
}
