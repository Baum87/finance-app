import Decimal from 'decimal.js'
import { createServerSupabaseClient } from '@/lib/db/supabase-server'
import { getAssetsWithValues, getMortgageBalancesMap } from '@/lib/db/queries/assets'
import { calculateNetWorth } from '@/lib/finance'
import { formatCurrency } from '@/lib/utils/format'
import { Topbar } from '@/components/layout/Topbar'
import { KpiCard } from '@/components/ui/KpiCard'

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Goedemorgen'
  if (hour < 18) return 'Goedemiddag'
  return 'Goedenavond'
}

export default async function OverzichtPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [assets, mortgageMap] = await Promise.all([
    getAssetsWithValues(user!.id),
    getMortgageBalancesMap(user!.id),
  ])

  const netWorth = calculateNetWorth(
    assets.map(a => ({
      value: a.currentValue,
      liability: mortgageMap.get(a.id) ?? new Decimal(0),
    })),
  )

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

        {/* Blok 3 — Actief doel */}
        <div className="bg-card border border-border rounded-3xl p-6">
          <p className="text-sm font-medium text-muted-foreground">Actief doel</p>
          <p className="mt-3 text-foreground">Stel een financieel doel in</p>
          <div className="mt-4 h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-sage" style={{ width: '0%' }} />
          </div>
          <button
            disabled
            className="mt-4 px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground cursor-not-allowed opacity-60"
          >
            Komt in een volgende versie
          </button>
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
