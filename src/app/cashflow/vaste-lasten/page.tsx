import { createServerSupabaseClient } from '@/lib/db/supabase-server'
import { getRecurringItems } from '@/lib/db/queries/recurring-items'
import { calculateRecurringTotals } from '@/lib/finance'
import { formatCurrency } from '@/lib/utils/format'
import { Topbar } from '@/components/layout/Topbar'
import { KpiCard } from '@/components/ui/KpiCard'
import { RecurringItemForm } from '@/components/cashflow/RecurringItemForm'
import { RecurringItemList } from '@/components/cashflow/RecurringItemList'
import { createRecurringItemAction, updateRecurringItemAction, deleteRecurringItemAction } from '@/app/cashflow/actions'

export default async function VasteLastenPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user!.id

  const recurringItemRows = await getRecurringItems(userId)

  const recurringTotals = calculateRecurringTotals(
    recurringItemRows.map(r => ({
      itemType:  r.itemType as 'income' | 'expense',
      amount:    r.amount,
      frequency: r.frequency as 'monthly' | 'four_weekly' | 'quarterly' | 'yearly',
      isActive:  r.isActive,
      isShared:  r.isShared,
    })),
  )

  return (
    <>
      <Topbar />
      <main className="mx-auto max-w-[1200px] px-8 py-12 space-y-6">

        <div>
          <h1 className="text-2xl font-semibold text-foreground">Vaste lasten & inkomsten</h1>
          <p className="mt-1 text-sm text-muted-foreground">Salaris, verzekeringen, abonnementen, hypotheek en overige vaste posten</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <KpiCard
            label="Inkomen per maand"
            value={formatCurrency(recurringTotals.monthlyIncome.toNumber())}
            subtext={`${formatCurrency(recurringTotals.annualIncome.toNumber())} per jaar`}
          />
          <KpiCard
            label="Vaste lasten per maand"
            value={formatCurrency(recurringTotals.monthlyExpenses.toNumber())}
            subtext={`${formatCurrency(recurringTotals.annualExpenses.toNumber())} per jaar`}
          />
          <KpiCard
            label="Netto cashflow per maand"
            value={`${recurringTotals.netMonthlyCashflow.gte(0) ? '+' : ''}${formatCurrency(recurringTotals.netMonthlyCashflow.toNumber())}`}
            subtext={`${formatCurrency(recurringTotals.netAnnualCashflow.toNumber())} per jaar`}
            trend={{
              value:    recurringTotals.netMonthlyCashflow.gte(0) ? 'Overschot' : 'Tekort',
              positive: recurringTotals.netMonthlyCashflow.gte(0),
            }}
          />
        </div>

        <RecurringItemForm action={createRecurringItemAction} />

        {recurringItemRows.length === 0 ? (
          <div className="bg-card border border-border rounded-3xl p-10 text-center">
            <p className="text-sm text-muted-foreground italic">Nog geen vaste lasten of inkomsten geregistreerd.</p>
          </div>
        ) : (
          <RecurringItemList
            items={recurringItemRows}
            updateAction={updateRecurringItemAction}
            deleteAction={deleteRecurringItemAction}
          />
        )}

      </main>
    </>
  )
}
