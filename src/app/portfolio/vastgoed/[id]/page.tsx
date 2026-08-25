import Link from 'next/link'
import { notFound } from 'next/navigation'
import Decimal from 'decimal.js'
import { createServerSupabaseClient } from '@/lib/db/supabase-server'
import { getAssetWithCalculations } from '@/lib/db/queries/assets'
import { getTransactions } from '@/lib/db/queries/transactions'
import {
  calculateNetRentalYield,
  calculateGrossRentalYield,
  calculateCashOnCash,
  calculateLtv,
  calculateEquity,
  calculateXirr,
} from '@/lib/finance'
import { formatCurrency, formatPercent, formatAddress } from '@/lib/utils/format'
import { Topbar } from '@/components/layout/Topbar'
import { KpiCard } from '@/components/ui/KpiCard'
import { ProgressBar } from '@/components/ui/ProgressBar'
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

function groupByYear(
  txs: { transactionType: string; amount: string; transactionDate: string }[],
): { year: number; income: Decimal; costs: Decimal; net: Decimal }[] {
  const years = new Map<number, { income: Decimal; costs: Decimal }>()
  for (const tx of txs) {
    const year = new Date(tx.transactionDate).getFullYear()
    const entry = years.get(year) ?? { income: new Decimal(0), costs: new Decimal(0) }
    if (tx.transactionType === 'rental_income') entry.income = entry.income.plus(new Decimal(tx.amount))
    else if (tx.transactionType === 'cost')    entry.costs = entry.costs.plus(new Decimal(tx.amount))
    years.set(year, entry)
  }
  return [...years.entries()]
    .sort(([a], [b]) => b - a)
    .slice(0, 3)
    .map(([year, { income, costs }]) => ({
      year,
      income: income.toDecimalPlaces(2),
      costs: costs.toDecimalPlaces(2),
      net: income.minus(costs).toDecimalPlaces(2),
    }))
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
  const eigenVermogen = calculateEquity(currentValue, totaleHypotheek)
  const ltv = currentValue.gt(0) && totaleHypotheek.gt(0)
    ? calculateLtv(totaleHypotheek, currentValue)
    : null

  const propertyType = asset.realEstateDetails?.propertyType ?? ''
  const isRental = propertyType === 'rental'

  const txs = txList.map(t => ({
    transactionType: t.transactionType,
    amount: t.amount,
    transactionDate: t.transactionDate,
  }))

  // Rental-specifieke berekeningen
  // Let op: annualIncome is bewust bruto huurinkomen (alleen rental_income),
  // niet via calculatePassiveIncome — die trekt 'cost' er zelf al vanaf, wat
  // hieronder tot dubbele kostenaftrek zou leiden (annualCosts wordt hier apart
  // gebruikt voor zowel bruto/netto-rendement als cash-on-cash).
  const currentYearStart = `${new Date().getFullYear()}-01-01`
  const annualIncome = isRental
    ? txs
        .filter(t => t.transactionType === 'rental_income' && t.transactionDate >= currentYearStart)
        .reduce((sum, t) => sum.plus(new Decimal(t.amount)), new Decimal(0))
    : new Decimal(0)
  const annualCosts = isRental
    ? txs
        .filter(t => t.transactionType === 'cost' && t.transactionDate >= currentYearStart)
        .reduce((sum, t) => sum.plus(new Decimal(t.amount)), new Decimal(0))
    : new Decimal(0)

  const grossRentalYield = isRental && currentValue.gt(0) && annualIncome.gt(0)
    ? calculateGrossRentalYield(annualIncome, currentValue)
    : null
  const netRentalYield = isRental && currentValue.gt(0)
    ? calculateNetRentalYield(annualIncome, annualCosts, currentValue)
    : null

  const purchasePrice = asset.realEstateDetails?.purchasePrice
    ? new Decimal(asset.realEstateDetails.purchasePrice)
    : null
  const purchaseCosts = asset.realEstateDetails?.purchaseCosts
    ? new Decimal(asset.realEstateDetails.purchaseCosts)
    : new Decimal(0)
  const mortgageOriginal = mortgages[0]?.originalAmount
    ? new Decimal(mortgages[0].originalAmount)
    : new Decimal(0)
  const initialInvestment = purchasePrice
    ? purchasePrice.plus(purchaseCosts).minus(mortgageOriginal)
    : null

  const annualNetCashflow = annualIncome.minus(annualCosts)
  const cashOnCash = isRental && initialInvestment?.gt(0)
    ? calculateCashOnCash(annualNetCashflow, initialInvestment)
    : null

  let rentalXirr: Decimal | null = null
  if (isRental && eigenVermogen.gt(0)) {
    const OUTFLOWS = new Set(['buy', 'cost', 'deposit'])
    const INFLOWS  = new Set(['sell', 'rental_income', 'withdrawal', 'dividend', 'interest'])
    const cashflows = txList
      .map(t => {
        const sign = OUTFLOWS.has(t.transactionType) ? -1 : INFLOWS.has(t.transactionType) ? 1 : 0
        return { amount: new Decimal(t.amount).mul(sign), date: new Date(t.transactionDate) }
      })
      .filter(c => !c.amount.isZero())
    if (cashflows.length >= 1) {
      cashflows.push({ amount: eigenVermogen, date: new Date() })
      try { rentalXirr = calculateXirr(cashflows) } catch { /* onvoldoende data */ }
    }
  }

  const cashflowByYear = isRental ? groupByYear(txs) : []

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
                {formatAddress(asset.realEstateDetails) ?? PROPERTY_TYPE_LABELS[propertyType] ?? '—'}
                {formatAddress(asset.realEstateDetails) ? ` · ${PROPERTY_TYPE_LABELS[propertyType] ?? propertyType}` : ''}
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

        {/* KPI cards — eigen woning */}
        {!isRental && (
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
        )}

        {/* KPI cards — verhuurpand */}
        {isRental && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard
                label="Bruto huurrendement"
                value={grossRentalYield ? formatPercent(grossRentalYield.toNumber()) : '—'}
                subtext="Jaarinkomen / pandwaarde"
              />
              <KpiCard
                label="Netto huurrendement"
                value={netRentalYield ? formatPercent(netRentalYield.toNumber()) : '—'}
                subtext="Na exploitatiekosten"
              />
              <KpiCard
                label="Cash-on-cash"
                value={cashOnCash ? formatPercent(cashOnCash.toNumber()) : '—'}
                subtext="Op eigen inleg excl. hypotheek"
              />
              <KpiCard
                label="Totaalrendement"
                value={rentalXirr ? formatPercent(rentalXirr.toNumber()) : '—'}
                subtext="Incl. waardeontwikkeling — XIRR"
                trend={rentalXirr ? { value: formatPercent(rentalXirr.toNumber()), positive: rentalXirr.gt(0) } : undefined}
              />
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
          </>
        )}

        {/* LTV balk */}
        {ltv && (
          <div className="bg-card border border-border rounded-3xl p-6">
            <ProgressBar
              value={ltv.toNumber()}
              label="LTV — Loan-to-Value"
              subtext="Daalt naarmate je aflost of de waarde stijgt."
            />
          </div>
        )}

        {/* Cashflow per jaar — alleen verhuur */}
        {isRental && cashflowByYear.length > 0 && (
          <div className="bg-card border border-border rounded-3xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border">
              <p className="text-sm font-medium text-foreground">Cashflow per jaar</p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-6 py-3 text-muted-foreground font-medium">Jaar</th>
                  <th className="text-right px-6 py-3 text-muted-foreground font-medium">Huurinkomsten</th>
                  <th className="text-right px-6 py-3 text-muted-foreground font-medium">Kosten</th>
                  <th className="text-right px-6 py-3 text-muted-foreground font-medium">Netto</th>
                </tr>
              </thead>
              <tbody>
                {cashflowByYear.map(row => (
                  <tr key={row.year} className="border-b border-border last:border-0">
                    <td className="px-6 py-3 font-medium text-foreground">{row.year}</td>
                    <td className="px-6 py-3 text-right text-foreground">{formatCurrency(row.income.toNumber())}</td>
                    <td className="px-6 py-3 text-right text-muted-foreground">{formatCurrency(row.costs.toNumber())}</td>
                    <td className={`px-6 py-3 text-right font-medium ${row.net.gte(0) ? 'text-sage' : 'text-terracotta'}`}>
                      {row.net.gte(0) ? '+' : ''}{formatCurrency(row.net.toNumber())}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

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
