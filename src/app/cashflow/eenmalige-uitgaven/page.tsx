import { createServerSupabaseClient } from '@/lib/db/supabase-server'
import { getOneTimeExpenses } from '@/lib/db/queries/one-time-expenses'
import { calculateOneTimeExpensesTotal, calculatePercentChange } from '@/lib/finance'
import { formatCurrency, formatPercent } from '@/lib/utils/format'
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

  const oneTimeExpensesThisYear = calculateOneTimeExpensesTotal(
    oneTimeExpenseRows.filter(e => e.expenseDate.slice(0, 4) === String(currentYear)),
  )

  const oneTimeExpensesPrevYear = calculateOneTimeExpensesTotal(
    oneTimeExpenseRows.filter(e => e.expenseDate.slice(0, 4) === String(currentYear - 1)),
  )
  const percentChange = calculatePercentChange(oneTimeExpensesThisYear, oneTimeExpensesPrevYear)

  return (
    <>
      <Topbar />
      <main className="mx-auto max-w-[1200px] px-8 py-12 space-y-6">

        <div>
          <h1 className="text-2xl font-semibold text-foreground">Eenmalige uitgaven</h1>
          <p className="mt-1 text-sm text-muted-foreground">Losstaande grote aankopen, geen doorlopende post</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <KpiCard
            label="Eenmalige uitgaven dit jaar"
            value={formatCurrency(oneTimeExpensesThisYear.toNumber())}
            subtext={`t/m ${todayStr} — telt niet mee in de maandelijkse cashflow van vaste lasten`}
          />
          <KpiCard
            label="Verschil t.o.v. vorig jaar"
            value={percentChange === null
              ? '—'
              : `${percentChange.gte(0) ? '+' : ''}${formatPercent(percentChange.toNumber())}`}
            subtext={percentChange === null
              ? `Geen uitgaven in ${currentYear - 1} om mee te vergelijken`
              : `${formatCurrency(oneTimeExpensesPrevYear.toNumber())} in heel ${currentYear - 1}`}
            trend={percentChange !== null
              ? { value: percentChange.gte(0) ? 'Meer uitgegeven' : 'Minder uitgegeven', positive: percentChange.lte(0) }
              : undefined}
          />
        </div>

        <OneTimeExpenseForm action={createOneTimeExpenseAction} />

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

      </main>
    </>
  )
}
