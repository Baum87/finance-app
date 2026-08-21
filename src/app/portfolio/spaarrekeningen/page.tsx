import Decimal from 'decimal.js'
import { createServerSupabaseClient } from '@/lib/db/supabase-server'
import { getSavingsEntries, latestPerGroup, groupBy } from '@/lib/db/queries/simple-entries'
import { formatCurrency } from '@/lib/utils/format'
import { Topbar } from '@/components/layout/Topbar'
import { KpiCard } from '@/components/ui/KpiCard'
import { EntryLogForm } from '@/components/portfolio/EntryLogForm'
import { EntryLogList } from '@/components/portfolio/EntryLogList'
import { createSavingsEntryAction, updateSavingsEntryAction, deleteSavingsEntryAction } from '@/app/portfolio/simple-entry-actions'

const FIELDS = [
  { name: 'bank', label: 'Bank' },
  { name: 'balance', label: 'Vermogen', type: 'number' as const, format: 'currency' as const },
  { name: 'entryDate', label: 'Datum', type: 'date' as const, format: 'date' as const },
]

export default async function SpaarrekeningenPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  const entries = await getSavingsEntries(user!.id)
  const latestPerBank = latestPerGroup(entries, e => e.bank)
  const byBank = groupBy(entries, e => e.bank)

  const totalBalance = latestPerBank.reduce((s, e) => s.plus(new Decimal(e.balance)), new Decimal(0))

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
            label="Totaal vermogen"
            value={latestPerBank.length > 0 ? formatCurrency(totalBalance.toNumber()) : '—'}
            subtext="Som van laatste invoer per bank"
          />
          <KpiCard
            label="Banken"
            value={String(latestPerBank.length)}
            subtext="Actieve rekeningen"
          />
        </div>

        <EntryLogForm
          action={createSavingsEntryAction}
          fields={[
            { name: 'bank', label: 'Bank', placeholder: 'ING' },
            { name: 'balance', label: 'Vermogen (€)', type: 'number', placeholder: '15000' },
            { name: 'entryDate', label: 'Datum', type: 'date' },
          ]}
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
