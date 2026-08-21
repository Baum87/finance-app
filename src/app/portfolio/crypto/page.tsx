import Decimal from 'decimal.js'
import { createServerSupabaseClient } from '@/lib/db/supabase-server'
import { getCryptoEntries, latestPerGroup, groupBy } from '@/lib/db/queries/simple-entries'
import { buildSimpleEntryMonthlySeries } from '@/lib/finance'
import { formatCurrency, formatPercent } from '@/lib/utils/format'
import { Topbar } from '@/components/layout/Topbar'
import { KpiCard } from '@/components/ui/KpiCard'
import { EntryLogForm } from '@/components/portfolio/EntryLogForm'
import { EntryLogList } from '@/components/portfolio/EntryLogList'
import { InvestedVsValueChart } from '@/components/portfolio/InvestedVsValueChart'
import { createCryptoEntryAction, updateCryptoEntryAction, deleteCryptoEntryAction } from '@/app/portfolio/simple-entry-actions'

const FIELDS = [
  { name: 'broker', label: 'Broker' },
  { name: 'invested', label: 'Ingelegd', type: 'number' as const, format: 'currency' as const },
  { name: 'currentValue', label: 'Huidige waarde', type: 'number' as const, format: 'currency' as const },
  { name: 'entryDate', label: 'Datum', type: 'date' as const, format: 'date' as const },
]

export default async function CryptoPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  const entries = await getCryptoEntries(user!.id)
  const latestPerBroker = latestPerGroup(entries, e => e.broker)
  const byBroker = groupBy(entries, e => e.broker)

  const totalCurrentValue = latestPerBroker.reduce((s, e) => s.plus(new Decimal(e.currentValue)), new Decimal(0))
  const totalInvested = latestPerBroker.reduce((s, e) => s.plus(new Decimal(e.invested)), new Decimal(0))
  const totalGainLoss = totalCurrentValue.minus(totalInvested)
  const gainLossPct = totalInvested.gt(0) ? totalGainLoss.div(totalInvested) : null
  const monthlySeries = buildSimpleEntryMonthlySeries(entries).map(p => ({
    month: p.month,
    invested: p.invested.toNumber(),
    currentValue: p.currentValue.toNumber(),
  }))

  return (
    <>
      <Topbar />
      <main className="mx-auto max-w-[1200px] px-8 py-12 space-y-8">

        <div>
          <h1 className="text-2xl font-semibold text-foreground">Crypto</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {entries.length} invoer{entries.length !== 1 ? 'en' : ''} bij {latestPerBroker.length} broker{latestPerBroker.length !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <KpiCard
            label="Huidige waarde"
            value={latestPerBroker.length > 0 ? formatCurrency(totalCurrentValue.toNumber()) : '—'}
            subtext="Som van laatste invoer per broker"
          />
          <KpiCard
            label="Totaal ingelegd"
            value={latestPerBroker.length > 0 ? formatCurrency(totalInvested.toNumber()) : '—'}
            subtext="Som van laatste invoer per broker"
          />
          <KpiCard
            label="Winst / verlies"
            value={latestPerBroker.length > 0
              ? `${totalGainLoss.gte(0) ? '+' : ''}${formatCurrency(totalGainLoss.toNumber())}`
              : '—'}
            subtext="Huidige waarde min ingelegd"
            trend={gainLossPct ? { value: formatPercent(gainLossPct.toNumber()), positive: totalGainLoss.gte(0) } : undefined}
          />
        </div>

        <EntryLogForm
          action={createCryptoEntryAction}
          fields={[
            { name: 'broker', label: 'Broker / exchange', placeholder: 'Bitvavo' },
            { name: 'invested', label: 'Ingelegd bedrag (€)', type: 'number', placeholder: '5000' },
            { name: 'currentValue', label: 'Huidige waarde (€)', type: 'number', placeholder: '6200' },
            { name: 'entryDate', label: 'Datum', type: 'date' },
          ]}
        />

        <InvestedVsValueChart data={monthlySeries} />

        {byBroker.size === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-12 text-center">
            <p className="text-sm text-muted-foreground">Nog geen crypto-gegevens ingevoerd.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {[...byBroker.entries()].map(([broker, rows]) => (
              <div key={broker}>
                <h2 className="mb-2 text-sm font-semibold text-foreground">{broker}</h2>
                <EntryLogList
                  fields={FIELDS}
                  updateAction={updateCryptoEntryAction}
                  deleteAction={deleteCryptoEntryAction}
                  footerLabel="Huidige waarde"
                  footerValue={formatCurrency(Number(rows[0].currentValue))}
                  rows={rows.map(e => ({
                    id: e.id,
                    broker: e.broker,
                    invested: e.invested,
                    currentValue: e.currentValue,
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
