import Decimal from 'decimal.js'
import { createServerSupabaseClient } from '@/lib/db/supabase-server'
import { getAssetsWithValues, getMortgageBalancesMap } from '@/lib/db/queries/assets'
import { getNetWorthAtDate } from '@/lib/db/queries/cashflow'
import { calculateNetWorth, calculateAllocation } from '@/lib/finance'
import { formatCurrency } from '@/lib/utils/format'
import { Topbar } from '@/components/layout/Topbar'
import { KpiCard } from '@/components/ui/KpiCard'

const ASSET_TYPE_LABELS: Record<string, string> = {
  stock_etf:   'Aandelen & ETF',
  crypto:      'Crypto',
  savings:     'Spaargeld',
  real_estate: 'Vastgoed',
  pension:     'Pensioen',
}

function buildInsightText(
  netWorth: Decimal,
  netWorthMonthAgo: Decimal | null,
  biggestCategory: string | null,
  biggestPct: number | null,
): string {
  const parts: string[] = []

  if (biggestCategory && biggestPct != null) {
    parts.push(
      `Je grootste positie is ${biggestCategory} (${biggestPct.toFixed(0)}% van je totale vermogen).`,
    )
  }

  if (netWorthMonthAgo != null) {
    const delta = netWorth.minus(netWorthMonthAgo)
    const sign  = delta.gte(0) ? '+' : ''
    const word  = delta.gte(0) ? 'gegroeid' : 'gedaald'
    parts.push(
      `Je netto vermogen is de afgelopen 30 dagen ${word} met ${sign}${formatCurrency(delta.toNumber())}.`,
    )
  }

  return parts.length > 0
    ? parts.join(' ')
    : 'Voeg assets en waarderingen toe om inzichten te zien.'
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

  const allocationSlices = calculateAllocation(
    assets.map(a => ({ assetType: a.assetType, value: a.currentValue })),
  )
  const biggest = allocationSlices.sort((x, y) => y.value.minus(x.value).toNumber())[0]
  const biggestCategory = biggest ? (ASSET_TYPE_LABELS[biggest.assetType] ?? biggest.assetType) : null
  const biggestPct = biggest ? biggest.percentage.toNumber() : null

  const insightText = buildInsightText(netWorth, netWorthMonthAgo, biggestCategory, biggestPct)

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

        {/* Blok 2 — Netto vermogen */}
        <KpiCard
          label="Netto vermogen"
          value={netWorth.gt(0) ? formatCurrency(netWorth.toNumber()) : '—'}
          subtext={assets.length === 0 ? 'Voeg assets toe om je vermogen te zien.' : undefined}
        />

        {/* Blok 3 — Belangrijkste inzicht */}
        <div className="bg-card border border-border rounded-3xl p-6">
          <p className="text-sm font-medium text-muted-foreground">Inzicht</p>
          <p className="mt-3 text-foreground leading-relaxed">{insightText}</p>
        </div>

        {/* Blok 4 — AI Coach */}
        <div className="bg-card border border-border rounded-3xl p-6">
          <p className="text-sm font-medium text-muted-foreground">AI Coach</p>
          <p className="mt-3 text-foreground">Komt in een volgende versie.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Straks kun je hier vragen stellen over je financiën.
          </p>
        </div>

      </main>
    </>
  )
}
