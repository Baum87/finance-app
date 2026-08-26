import Decimal from 'decimal.js'
import { createServerSupabaseClient } from '@/lib/db/supabase-server'
import { getSavingsEntries, latestPerGroup, groupBy } from '@/lib/db/queries/simple-entries'
import { getAssetsWithValues } from '@/lib/db/queries/assets'
import { buildSingleValueMonthlySeries } from '@/lib/finance'
import { formatCurrency, formatPercent } from '@/lib/utils/format'
import { Topbar } from '@/components/layout/Topbar'
import { KpiCard } from '@/components/ui/KpiCard'
import { EntryLogForm } from '@/components/portfolio/EntryLogForm'
import { EntryLogList } from '@/components/portfolio/EntryLogList'
import { SingleLineChart } from '@/components/portfolio/SingleLineChart'
import { AssetPositionsCard } from '@/components/portfolio/AssetPositionsCard'
import { createSavingsEntryAction, updateSavingsEntryAction, deleteSavingsEntryAction } from '@/app/portfolio/simple-entry-actions'

const FIELDS = [
  { name: 'bank', label: 'Bank' },
  { name: 'balance', label: 'Vermogen', type: 'number' as const, format: 'currency' as const },
  { name: 'entryDate', label: 'Datum', type: 'date' as const, format: 'date' as const },
]

export default async function SpaarrekeningenPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [entries, assets] = await Promise.all([
    getSavingsEntries(user!.id),
    getAssetsWithValues(user!.id),
  ])
  const latestPerBank = latestPerGroup(entries, e => e.bank)
  const byBank = groupBy(entries, e => e.bank)

  const assetPositions = assets
    .filter(a => a.assetType === 'savings')
    .map(a => ({ id: a.id, name: a.name, currentValue: a.currentValue.toNumber() }))

  const totalBalance = latestPerBank.reduce((s, e) => s.plus(new Decimal(e.balance)), new Decimal(0))

  const monthlySeries = buildSingleValueMonthlySeries(
    entries.map(e => ({ group: e.bank, value: e.balance, entryDate: e.entryDate })),
  )
  const lastYear = new Date().getFullYear() - 1
  const yearEndPoint = monthlySeries.find(p => p.month === `${lastYear}-12`)
  const yearEndValue = yearEndPoint ? yearEndPoint.value : null
  const difference = yearEndValue !== null ? totalBalance.minus(yearEndValue) : null
  const differencePct = difference !== null && yearEndValue!.gt(0) ? difference.div(yearEndValue!) : null

  return (
    <>
      <Topbar />
      <main className="mx-auto max-w-[1200px] px-8 py-12 space-y-8">

        <div>
          <h1 className="text-2xl font-semibold text-foreground">Spaarrekeningen</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {entries.length} invoer{entries.length !== 1 ? 'en' : ''} bij {latestPerBank.length} bank{latestPerBank.length !== 1 ? 'en' : ''}
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <KpiCard
            label={`Waarde eind ${lastYear}`}
            value={yearEndValue !== null ? formatCurrency(yearEndValue.toNumber()) : '—'}
            subtext="Laatste invoer van dat jaar"
          />
          <KpiCard
            label="Huidige waarde"
            value={latestPerBank.length > 0 ? formatCurrency(totalBalance.toNumber()) : '—'}
            subtext="Som van laatste invoer per bank"
          />
          <KpiCard
            label="Verschil"
            value={difference !== null
              ? `${difference.gte(0) ? '+' : ''}${formatCurrency(difference.toNumber())}`
              : '—'}
            subtext={`T.o.v. eind ${lastYear}`}
            trend={differencePct ? { value: formatPercent(differencePct.toNumber()), positive: difference!.gte(0) } : undefined}
          />
        </div>

        <AssetPositionsCard
          positions={assetPositions}
          addHref="/assets/new?type=savings&cancel=/portfolio/spaarrekeningen"
          addLabel="+ Spaarrekening met transacties toevoegen"
          description="Met stortingen/opnames/rente bijgehouden — voedt rente-inkomsten"
          backTo="/portfolio/spaarrekeningen"
        />

        <EntryLogForm
          action={createSavingsEntryAction}
          fields={[
            { name: 'bank', label: 'Bank', placeholder: 'ING' },
            { name: 'balance', label: 'Vermogen (€)', type: 'number', placeholder: '15000' },
            { name: 'entryDate', label: 'Datum', type: 'date' },
          ]}
        />

        <SingleLineChart
          title="Verloop vermogen"
          valueLabel="Vermogen"
          data={monthlySeries.map(p => ({ month: p.month, value: p.value.toNumber() }))}
        />

        {byBank.size === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-12 text-center">
            <p className="text-sm text-muted-foreground">Nog geen spaargegevens ingevoerd.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {[...byBank.entries()].map(([bank, rows]) => (
              <div key={bank}>
                <h2 className="mb-2 text-sm font-semibold text-foreground">{bank}</h2>
                <EntryLogList
                  fields={FIELDS}
                  updateAction={updateSavingsEntryAction}
                  deleteAction={deleteSavingsEntryAction}
                  footerLabel="Vermogen"
                  footerValue={formatCurrency(Number(rows[0].balance))}
                  rows={rows.map(e => ({
                    id: e.id,
                    bank: e.bank,
                    balance: e.balance,
                    entryDate: e.entryDate,
                  }))}
                />
              </div>
            ))}
          </div>
        )}

      </main>
    </>
  )
}
