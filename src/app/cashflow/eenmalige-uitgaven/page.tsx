import Decimal from 'decimal.js'
import { createServerSupabaseClient } from '@/lib/db/supabase-server'
import { getOneTimeExpenses } from '@/lib/db/queries/one-time-expenses'
import { formatCurrency } from '@/lib/utils/format'
import { Topbar } from '@/components/layout/Topbar'
import { KpiCard } from '@/components/ui/KpiCard'
import { OneTimeExpenseForm } from '@/components/cashflow/OneTimeExpenseForm'
import { OneTimeExpenseList } from '@/components/cashflow/OneTimeExpenseList'
import { createOneTimeExpenseAction, updateOneTimeExpenseAction, deleteOneTimeExpenseAction } from '@/app/cashflow/actions'

export default async function EenmaligeUitgavenPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user!.id

  const today = new Date()
  const currentYear = today.getFullYear()
  const todayStr = today.toISOString().slice(0, 10)

  const oneTimeExpenseRows = await getOneTimeExpenses(userId)

  const oneTimeExpensesThisYear = oneTimeExpenseRows
    .filter(e => e.expenseDate.slice(0, 4) === String(currentYear))
    .reduce((s, e) => s.plus(e.amount), new Decimal(0))

  return (
    <>
      <Topbar />
      <main className="mx-auto max-w-[1200px] px-8 py-12 space-y-6">

        <div>
          <h1 className="text-2xl font-semibold text-foreground">Eenmalige uitgaven</h1>
          <p className="mt-1 text-sm text-muted-foreground">Losstaande grote aankopen, geen doorlopende post</p>
        </div>

        <KpiCard
          label="Eenmalige uitgaven dit jaar"
          value={formatCurrency(oneTimeExpensesThisYear.toNumber())}
          subtext={`t/m ${todayStr} — telt niet mee in de maandelijkse cashflow van vaste lasten`}
        />

        {oneTimeExpenseRows.length === 0 ? (
          <div className="bg-card border border-border rounded-3xl p-10 text-center">
            <p className="text-sm text-muted-foreground italic">Nog geen eenmalige uitgaven geregistreerd.</p>
          </div>
        ) : (
          <OneTimeExpenseList
            expenses={oneTimeExpenseRows}
            updateAction={updateOneTimeExpenseAction}
            deleteAction={deleteOneTimeExpenseAction}
          />
        )}

        <OneTimeExpenseForm action={createOneTimeExpenseAction} />

      </main>
    </>
  )
}
