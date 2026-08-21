import Decimal from 'decimal.js'
import { createServerSupabaseClient } from '@/lib/db/supabase-server'
import { getRealEstateEntries, latestPerGroup, groupBy } from '@/lib/db/queries/simple-entries'
import { formatCurrency } from '@/lib/utils/format'
import { Topbar } from '@/components/layout/Topbar'
import { KpiCard } from '@/components/ui/KpiCard'
import { EntryLogForm } from '@/components/portfolio/EntryLogForm'
import { EntryLogList } from '@/components/portfolio/EntryLogList'
import { createRealEstateEntryAction, updateRealEstateEntryAction, deleteRealEstateEntryAction } from '@/app/portfolio/simple-entry-actions'

const FIELDS = [
  { name: 'street', label: 'Straat' },
  { name: 'postalCode', label: 'Postcode' },
  { name: 'city', label: 'Plaats' },
  { name: 'wozValue', label: 'WOZ-waarde', type: 'number' as const, format: 'currency' as const },
  { name: 'entryDate', label: 'Datum', type: 'date' as const, format: 'date' as const },
]

export default async function VastgoedPortfolioPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  const entries = await getRealEstateEntries(user!.id)
  const addressKey = (e: (typeof entries)[number]) => `${e.street}|${e.postalCode}|${e.city}`
  const latestPerAddress = latestPerGroup(entries, addressKey)
  const byAddress = groupBy(entries, addressKey)

  const totalWozValue = latestPerAddress.reduce((s, e) => s.plus(new Decimal(e.wozValue)), new Decimal(0))

  return (
    <>
      <Topbar />
      <main className="mx-auto max-w-[1200px] px-8 py-12 space-y-8">

        <div>
          <h1 className="text-2xl font-semibold text-foreground">Vastgoed</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {entries.length} invoer{entries.length !== 1 ? 'en' : ''} bij {latestPerAddress.length} pand{latestPerAddress.length !== 1 ? 'en' : ''}
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <KpiCard
            label="Totale WOZ-waarde"
            value={latestPerAddress.length > 0 ? formatCurrency(totalWozValue.toNumber()) : '—'}
            subtext="Som van laatste invoer per pand"
          />
          <KpiCard
            label="Panden"
            value={String(latestPerAddress.length)}
            subtext="Actieve panden"
          />
        </div>

        <EntryLogForm
          action={createRealEstateEntryAction}
          fields={[
            { name: 'street', label: 'Straat en huisnummer', placeholder: 'Keizersgracht 1' },
            { name: 'postalCode', label: 'Postcode', placeholder: '1015 CJ' },
            { name: 'city', label: 'Plaats', placeholder: 'Amsterdam' },
            { name: 'wozValue', label: 'WOZ-waarde (€)', type: 'number', placeholder: '420000' },
            { name: 'entryDate', label: 'Datum', type: 'date' },
          ]}
        />

        {byAddress.size === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-12 text-center">
            <p className="text-sm text-muted-foreground">Nog geen vastgoedgegevens ingevoerd.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {[...byAddress.entries()].map(([key, rows]) => (
              <div key={key}>
                <h2 className="mb-2 text-sm font-semibold text-foreground">{rows[0].street}, {rows[0].city}</h2>
                <EntryLogList
                  fields={FIELDS}
                  updateAction={updateRealEstateEntryAction}
                  deleteAction={deleteRealEstateEntryAction}
                  footerLabel="WOZ-waarde"
                  footerValue={formatCurrency(Number(rows[0].wozValue))}
                  rows={rows.map(e => ({
                    id: e.id,
                    street: e.street,
                    postalCode: e.postalCode,
                    city: e.city,
                    wozValue: e.wozValue,
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
