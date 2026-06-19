import Link from 'next/link'
import { notFound } from 'next/navigation'
import Decimal from 'decimal.js'
import { createServerSupabaseClient } from '@/lib/db/supabase-server'
import { getAssetWithCalculations } from '@/lib/db/queries/assets'
import { getTransactions } from '@/lib/db/queries/transactions'
import { formatCurrency } from '@/lib/utils/format'
import { Topbar } from '@/components/layout/Topbar'
import { KpiCard } from '@/components/ui/KpiCard'
import { TransactionList } from '@/components/assets/TransactionList'
import { DeleteAssetButton } from '@/components/portfolio/DeleteAssetButton'
import { applyMonthlyDepositAction } from '@/app/portfolio/spaarrekeningen/actions'

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  savings:  'Spaarrekening',
  checking: 'Betaalrekening',
  deposit:  'Deposito',
}

export default async function SpaarrekenigDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [result, txList] = await Promise.all([
    getAssetWithCalculations(user!.id, id),
    getTransactions(user!.id, id),
  ])

  if (!result || result.asset.assetType !== 'savings') notFound()

  const { asset, calculations } = result
  const { currentValue } = calculations

  // Stortingen dit jaar
  const thisYear = new Date().getFullYear()
  const stortingenDitJaar = txList
    .filter(t => t.transactionType === 'deposit' && new Date(t.transactionDate).getFullYear() === thisYear)
    .reduce((s, t) => s.plus(new Decimal(t.amount)), new Decimal(0))

  // Verwachte rente dit jaar — op basis van beginsaldo + gewogen stortingen/opnames
  const interestRateNum = asset.savingsDetails?.interestRate
    ? parseFloat(asset.savingsDetails.interestRate)
    : null

  let verwachteRenteDitJaar: Decimal | null = null
  if (interestRateNum !== null) {
    const yearStart = `${thisYear}-01-01`
    const yearEndDate = new Date(`${thisYear}-12-31`)

    const balanceAtYearStart = txList
      .filter(t => t.transactionDate < yearStart)
      .reduce((sum, t) => {
        if (t.transactionType === 'deposit' || t.transactionType === 'interest') return sum.plus(t.amount)
        if (t.transactionType === 'withdrawal') return sum.minus(t.amount)
        return sum
      }, new Decimal(0))

    const weightedNetThisYear = txList
      .filter(t => t.transactionDate >= yearStart)
      .reduce((sum, t) => {
        const daysLeft = Math.max(0, (yearEndDate.getTime() - new Date(t.transactionDate).getTime()) / 86400000)
        const weight = new Decimal(Math.round(daysLeft)).div(365)
        if (t.transactionType === 'deposit') return sum.plus(new Decimal(t.amount).mul(weight))
        if (t.transactionType === 'withdrawal') return sum.minus(new Decimal(t.amount).mul(weight))
        return sum
      }, new Decimal(0))

    verwachteRenteDitJaar = balanceAtYearStart.plus(weightedNetThisYear)
      .mul(new Decimal(interestRateNum)).div(100)
  }

  const monthlyAmount = asset.savingsDetails?.monthlyDepositAmount
    ? new Decimal(asset.savingsDetails.monthlyDepositAmount)
    : null

  // Check of maandelijkse storting al toegepast is deze maand (alleen via "Toepassen"-knop)
  const now = new Date()
  const alToegepaatDezeMaand = txList.some(t => {
    if (t.transactionType !== 'deposit') return false
    const d = new Date(t.transactionDate)
    const sameMonth = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
    return sameMonth && (t.notes?.startsWith('Maandelijkse storting') ?? false)
  })

  const redirectTo = `/portfolio/spaarrekeningen/${id}`

  return (
    <>
      <Topbar />
      <main className="mx-auto max-w-[1200px] px-8 py-12 space-y-8">

        {/* Header */}
        <div>
          <Link
            href="/portfolio/spaarrekeningen"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Spaarrekeningen
          </Link>
          <div className="mt-4 flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-foreground">{asset.name}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {asset.savingsDetails?.bankName ?? '—'}
                {asset.savingsDetails?.accountType
                  ? ` · ${ACCOUNT_TYPE_LABELS[asset.savingsDetails.accountType] ?? asset.savingsDetails.accountType}`
                  : ''}
              </p>
            </div>
            <Link
              href={`/assets/${asset.id}/edit?from=/portfolio/spaarrekeningen/${asset.id}`}
              className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              Bewerken
            </Link>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            label="Huidig saldo"
            value={currentValue.gt(0) ? formatCurrency(currentValue.toNumber()) : '—'}
            subtext="Laatste geregistreerde stand"
          />
          <KpiCard
            label="Stortingen dit jaar"
            value={formatCurrency(stortingenDitJaar.toNumber())}
            subtext={`${thisYear} · alleen stortingen`}
          />
          <KpiCard
            label="Verwachte rente dit jaar"
            value={verwachteRenteDitJaar ? formatCurrency(verwachteRenteDitJaar.toNumber()) : '—'}
            subtext={interestRateNum !== null ? `Op basis van ${interestRateNum}% p.j.` : 'Geen rente ingesteld'}
            trend={verwachteRenteDitJaar ? { value: '', positive: true } : undefined}
          />
          <KpiCard
            label="Rente p.j."
            value={interestRateNum !== null ? `${interestRateNum}%` : '—'}
            subtext="Opgegeven rentepercentage"
          />
        </div>

        {/* Maandelijks terugkerend bedrag */}
        {monthlyAmount && (
          <div className="rounded-2xl border border-border bg-card p-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-foreground">Maandelijks terugkerend</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {formatCurrency(monthlyAmount.toNumber())} per maand
                {alToegepaatDezeMaand && (
                  <span className="ml-2 text-sage font-medium">· al toegepast deze maand</span>
                )}
              </p>
            </div>
            {!alToegepaatDezeMaand && (
              <form action={applyMonthlyDepositAction}>
                <input type="hidden" name="assetId" value={asset.id} />
                <input type="hidden" name="amount" value={monthlyAmount.toFixed(2)} />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  Toepassen
                </button>
              </form>
            )}
          </div>
        )}

        {/* Details */}
        <div className="rounded-2xl border border-border bg-card p-6">
          <p className="text-sm font-medium text-foreground mb-4">Details</p>
          <div className="space-y-0">
            {[
              { label: 'Bank', value: asset.savingsDetails?.bankName },
              { label: 'Type', value: asset.savingsDetails?.accountType
                ? ACCOUNT_TYPE_LABELS[asset.savingsDetails.accountType] ?? asset.savingsDetails.accountType
                : null },
              { label: 'Rentepercentage', value: interestRateNum !== null ? `${interestRateNum}%` : null },
            ].filter(r => r.value).map(r => (
              <div key={r.label} className="flex justify-between py-2 border-b border-border last:border-0">
                <span className="text-sm text-muted-foreground">{r.label}</span>
                <span className="text-sm font-medium text-foreground">{r.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Transacties */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Transacties</h2>
            <Link
              href={`/portfolio/spaarrekeningen/${asset.id}/transactie`}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
            >
              + Storting / opname / rente
            </Link>
          </div>
          <TransactionList
            transactions={txList}
            assetId={asset.id}
            addHref={`/portfolio/spaarrekeningen/${asset.id}/transactie`}
            redirectTo={redirectTo}
          />
        </div>

        {/* Rekening verwijderen */}
        <div className="flex justify-end pt-4">
          <DeleteAssetButton
            assetId={asset.id}
            assetName={asset.name}
            redirectTo="/portfolio/spaarrekeningen"
          />
        </div>

      </main>
    </>
  )
}
