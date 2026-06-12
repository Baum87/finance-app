import Decimal from 'decimal.js'
import { createServerSupabaseClient } from '@/lib/db/supabase-server'
import { getLiabilities } from '@/lib/db/queries/liabilities'
import { formatCurrency, formatPercent } from '@/lib/utils/format'
import { Topbar } from '@/components/layout/Topbar'
import { KpiCard } from '@/components/ui/KpiCard'
import { LiabilityForm } from '@/components/schulden/LiabilityForm'
import { DeleteLiabilityButton } from '@/components/schulden/DeleteLiabilityButton'
import { createLiabilityAction, deleteLiabilityAction } from './actions'

const LIABILITY_TYPE_LABELS: Record<string, string> = {
  student_loan:  'Studieschuld',
  personal_loan: 'Persoonlijke lening',
  other:         'Overig',
}

export default async function SchuldenPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user!.id

  const items = await getLiabilities(userId)

  const totalDebt = items.reduce((sum, l) => sum.plus(new Decimal(l.amount)), new Decimal(0))

  return (
    <>
      <Topbar />
      <main className="mx-auto max-w-[1200px] px-8 py-12 space-y-6">

        <div>
          <h1 className="text-2xl font-semibold text-foreground">Schulden</h1>
          <p className="mt-1 text-sm text-muted-foreground">Studieschuld, persoonlijke leningen en overige verplichtingen</p>
        </div>

        {/* KPI */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <KpiCard
            label="Totale schuld"
            value={totalDebt.gt(0) ? formatCurrency(totalDebt.toNumber()) : '—'}
            subtext={`${items.length} actieve schuld${items.length !== 1 ? 'en' : ''}`}
          />
        </div>

        {/* Lijst */}
        {items.length === 0 ? (
          <div className="bg-card border border-border rounded-3xl p-10 text-center">
            <p className="text-sm text-muted-foreground italic">Geen schulden geregistreerd.</p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-3xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-6 py-3 text-muted-foreground font-medium">Naam</th>
                  <th className="text-left px-6 py-3 text-muted-foreground font-medium">Type</th>
                  <th className="text-right px-6 py-3 text-muted-foreground font-medium">Openstaand</th>
                  <th className="text-right px-6 py-3 text-muted-foreground font-medium">Rente</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody>
                {items.map(liability => (
                  <tr key={liability.id} className="border-b border-border last:border-0">
                    <td className="px-6 py-3 font-medium text-foreground">{liability.name}</td>
                    <td className="px-6 py-3 text-muted-foreground">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted">
                        {LIABILITY_TYPE_LABELS[liability.liabilityType] ?? liability.liabilityType}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right font-medium text-foreground">
                      {formatCurrency(new Decimal(liability.amount).toNumber())}
                    </td>
                    <td className="px-6 py-3 text-right text-muted-foreground">
                      {liability.interestRate
                        ? formatPercent(new Decimal(liability.interestRate).toNumber())
                        : '—'}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <DeleteLiabilityButton
                        liabilityId={liability.id}
                        name={liability.name}
                        action={deleteLiabilityAction}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Formulier */}
        <LiabilityForm action={createLiabilityAction} />

      </main>
    </>
  )
}
