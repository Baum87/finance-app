import Link from 'next/link'
import { notFound } from 'next/navigation'
import Decimal from 'decimal.js'
import { createServerSupabaseClient } from '@/lib/db/supabase-server'
import { getAssetWithCalculations } from '@/lib/db/queries/assets'
import { getTransactions } from '@/lib/db/queries/transactions'
import { formatCurrency, formatPercent } from '@/lib/utils/format'
import { Topbar } from '@/components/layout/Topbar'
import { KpiCard } from '@/components/ui/KpiCard'
import { ValuationForm } from '@/components/assets/ValuationForm'
import { MortgageBalanceForm } from '@/components/assets/MortgageBalanceForm'
import { TransactionList } from '@/components/assets/TransactionList'
import { createValuationAction, createMortgageBalanceAction } from '@/app/assets/actions'
import { DeleteAssetButton } from '@/components/portfolio/DeleteAssetButton'

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  primary_residence: 'Eigen woning',
  rental:            'Verhuurpand',
  vacation:          'Vakantiewoning',
}

function BalanceHistory({ balances }: {
  balances: { id: string; balanceDate: string; outstandingBalance: string }[]
}) {
  if (balances.length === 0) return null
  return (
    <div className="space-y-1 pt-4 border-t border-border">
      <p className="text-xs font-medium text-muted-foreground mb-2">Saldo-historie</p>
      {balances.map(b => (
        <div key={b.id} className="flex justify-between py-1.5">
          <span className="text-sm text-muted-foreground">{b.balanceDate}</span>
          <span className="text-sm font-medium text-foreground">{formatCurrency(Number(b.outstandingBalance))}</span>
        </div>
      ))}
    </div>
  )
}

export default async function VastgoedDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [result, txList] = await Promise.all([
    getAssetWithCalculations(user!.id, id),
    getTransactions(user!.id, id),
  ])

  if (!result || result.asset.assetType !== 'real_estate') notFound()

  const { asset, calculations } = result
  const { currentValue } = calculations

  const mortgages = asset.mortgages ?? []
  const totaleHypotheek = mortgages.reduce((s, m) => {
    const bal = m.balances?.[0]?.outstandingBalance
    return bal ? s.plus(new Decimal(bal)) : s
  }, new Decimal(0))
  const eigenVermogen = currentValue.minus(totaleHypotheek)
  const ltv = currentValue.gt(0) ? totaleHypotheek.div(currentValue) : null

  const propertyType = asset.realEstateDetails?.propertyType ?? ''

  return (
    <>
      <Topbar />
      <main className="mx-auto max-w-[1200px] px-8 py-12 space-y-8">

        <div>
          <Link
            href="/portfolio/vastgoed"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Vastgoed
          </Link>
          <div className="mt-4 flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-foreground">{asset.name}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {asset.realEstateDetails?.address ?? PROPERTY_TYPE_LABELS[propertyType] ?? '—'}
                {asset.realEstateDetails?.address ? ` · ${PROPERTY_TYPE_LABELS[propertyType] ?? propertyType}` : ''}
              </p>
            </div>
            <Link
              href={`/assets/${asset.id}/edit?from=/portfolio/vastgoed/${asset.id}`}
              className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              Bewerken
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            label="Marktwaarde"
            value={currentValue.gt(0) ? formatCurrency(currentValue.toNumber()) : '—'}
            subtext="Meest recente waardering"
          />
          <KpiCard
            label="Hypotheekschuld"
            value={totaleHypotheek.gt(0) ? formatCurrency(totaleHypotheek.toNumber()) : '—'}
            subtext="Openstaand saldo"
          />
          <KpiCard
            label="Eigen vermogen"
            value={currentValue.gt(0) ? formatCurrency(eigenVermogen.toNumber()) : '—'}
            subtext="Waarde min hypotheek"
            trend={currentValue.gt(0) ? { value: '', positive: eigenVermogen.gte(0) } : undefined}
          />
          <KpiCard
            label="LTV"
            value={ltv ? formatPercent(ltv.toNumber()) : '—'}
            subtext="Loan-to-value"
            trend={ltv ? { value: '', positive: ltv.lte(0.8) } : undefined}
          />
        </div>

        {/* Marktwaarde bijwerken */}
        <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
          <ValuationForm
            assetId={asset.id}
            currency={asset.currency}
            action={createValuationAction}
            label="Marktwaarde bijwerken"
          />
          {asset.valuations && asset.valuations.length > 0 && (
            <div className="space-y-1 pt-4 border-t border-border">
              <p className="text-xs font-medium text-muted-foreground mb-2">Waarde-historie</p>
              {asset.valuations.map(v => (
                <div key={v.id} className="flex justify-between py-1.5">
                  <span className="text-sm text-muted-foreground">{v.valuationDate}</span>
                  <span className="text-sm font-medium text-foreground">{formatCurrency(Number(v.value))}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Hypotheeksaldo bijwerken */}
        {mortgages.map(mortgage => (
          <div key={mortgage.id} className="rounded-2xl border border-border bg-card p-6 space-y-4">
            <MortgageBalanceForm
              assetId={asset.id}
              mortgageId={mortgage.id}
              lender={mortgage.lender}
              originalAmount={mortgage.originalAmount}
              interestRate={mortgage.interestRate}
              endDate={mortgage.endDate}
              action={createMortgageBalanceAction}
            />
            <BalanceHistory balances={mortgage.balances ?? []} />
          </div>
        ))}

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Transacties</h2>
            <Link
              href={`/assets/${asset.id}/transactions/new?from=/portfolio/vastgoed/${asset.id}`}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
            >
              + Transactie
            </Link>
          </div>
          <TransactionList
            transactions={txList}
            assetId={asset.id}
            addHref={`/assets/${asset.id}/transactions/new?from=/portfolio/vastgoed/${asset.id}`}
            redirectTo={`/portfolio/vastgoed/${asset.id}`}
          />
        </div>

        <div className="flex justify-end pt-4">
          <DeleteAssetButton assetId={asset.id} assetName={asset.name} redirectTo="/portfolio/vastgoed" />
        </div>

      </main>
    </>
  )
}
