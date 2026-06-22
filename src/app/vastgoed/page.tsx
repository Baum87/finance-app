import Decimal from 'decimal.js'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/db/supabase-server'
import { getAssetsWithValues, getAsset } from '@/lib/db/queries/assets'
import { getTransactions } from '@/lib/db/queries/transactions'
import {
  calculateNetRentalYield,
  calculateGrossRentalYield,
  calculateCashOnCash,
  calculateLtv,
  calculateEquity,
  calculateXirr,
  calculatePassiveIncome,
} from '@/lib/finance'
import { formatCurrency, formatPercent } from '@/lib/utils/format'
import { Topbar } from '@/components/layout/Topbar'
import { KpiCard } from '@/components/ui/KpiCard'
import { ProgressBar } from '@/components/ui/ProgressBar'

function groupByYear(
  txs: { transactionType: string; amount: string; transactionDate: string }[],
): { year: number; income: Decimal; costs: Decimal; net: Decimal }[] {
  const years = new Map<number, { income: Decimal; costs: Decimal }>()

  for (const tx of txs) {
    const year = new Date(tx.transactionDate).getFullYear()
    const entry = years.get(year) ?? { income: new Decimal(0), costs: new Decimal(0) }
    if (tx.transactionType === 'rental_income') {
      entry.income = entry.income.plus(new Decimal(tx.amount))
    } else if (tx.transactionType === 'cost') {
      entry.costs = entry.costs.plus(new Decimal(tx.amount))
    }
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

export default async function VastgoedPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user!.id

  const allAssets = await getAssetsWithValues(userId)
  const realEstateAssets = allAssets.filter(a => a.assetType === 'real_estate')

  if (realEstateAssets.length === 0) {
    return (
      <>
        <Topbar />
        <main className="mx-auto max-w-[1200px] px-8 py-12">
          <h1 className="text-2xl font-semibold text-foreground mb-6">Vastgoed</h1>
          <div className="bg-card border border-border rounded-3xl p-12 text-center">
            <p className="text-sm text-muted-foreground">Nog geen vastgoed toegevoegd.</p>
            <Link
              href="/assets/new"
              className="mt-3 inline-block px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Voeg vastgoed toe
            </Link>
          </div>
        </main>
      </>
    )
  }

  // Load full detail per real_estate asset
  const detailResults = await Promise.all(
    realEstateAssets.map(async (a) => {
      const [detail, txList] = await Promise.all([
        getAsset(userId, a.id),
        getTransactions(userId, a.id),
      ])
      return { summary: a, detail, txList }
    }),
  )

  return (
    <>
      <Topbar />
      <main className="mx-auto max-w-[1200px] px-8 py-12 space-y-10">

        <div>
          <h1 className="text-2xl font-semibold text-foreground">Vastgoed</h1>
          <p className="mt-1 text-sm text-muted-foreground">{realEstateAssets.length} object{realEstateAssets.length !== 1 ? 'en' : ''}</p>
        </div>

        {detailResults.map(({ summary, detail, txList }) => {
          if (!detail) return null

          const propertyType = detail.realEstateDetails?.propertyType ?? 'primary_residence'
          const propertyValue = summary.currentValue
          const latestValuation = detail.valuations[0]
          const storedValue = latestValuation ? new Decimal(latestValuation.value) : propertyValue

          // Latest mortgage balance
          const latestMortgage = detail.mortgages?.[0]
          const latestBalance = latestMortgage?.balances?.[0]
          const mortgage = latestBalance ? new Decimal(latestBalance.outstandingBalance) : new Decimal(0)

          const equity = calculateEquity(storedValue, mortgage)
          const ltv = mortgage.gt(0) && storedValue.gt(0) ? calculateLtv(mortgage, storedValue) : null

          const txs = txList.map(t => ({
            transactionType: t.transactionType,
            amount: t.amount,
            transactionDate: t.transactionDate,
          }))

          const isRental = propertyType === 'rental'

          // Rental calculations
          const annualIncome = isRental
            ? calculatePassiveIncome(txs.map(t => ({ ...t })), `${new Date().getFullYear()}-01-01`)
            : new Decimal(0)

          const annualCosts = isRental
            ? txs
                .filter(t => t.transactionType === 'cost' && t.transactionDate >= `${new Date().getFullYear()}-01-01`)
                .reduce((sum, t) => sum.plus(new Decimal(t.amount)), new Decimal(0))
            : new Decimal(0)

          const grossRentalYield = isRental && storedValue.gt(0) && annualIncome.gt(0)
            ? calculateGrossRentalYield(annualIncome, storedValue)
            : null

          const netRentalYield = isRental && storedValue.gt(0)
            ? calculateNetRentalYield(annualIncome, annualCosts, storedValue)
            : null

          const purchasePrice = detail.realEstateDetails?.purchasePrice
            ? new Decimal(detail.realEstateDetails.purchasePrice)
            : null
          const purchaseCosts = detail.realEstateDetails?.purchaseCosts
            ? new Decimal(detail.realEstateDetails.purchaseCosts)
            : new Decimal(0)
          const mortgageOriginal = latestMortgage?.originalAmount
            ? new Decimal(latestMortgage.originalAmount)
            : new Decimal(0)
          const initialInvestment = purchasePrice
            ? purchasePrice.plus(purchaseCosts).minus(mortgageOriginal)
            : null

          const annualNetCashflow = annualIncome.minus(annualCosts)
          const cashOnCash = isRental && initialInvestment?.gt(0)
            ? calculateCashOnCash(annualNetCashflow, initialInvestment)
            : null

          // XIRR for rental (all cashflow types + equity as closing value)
          let rentalXirr: Decimal | null = null
          if (isRental && equity.gt(0)) {
            const OUTFLOWS = new Set(['buy', 'cost', 'deposit'])
            const INFLOWS  = new Set(['sell', 'rental_income', 'withdrawal', 'dividend', 'interest'])
            const cashflows = txList
              .map(t => {
                const sign = OUTFLOWS.has(t.transactionType) ? -1
                  : INFLOWS.has(t.transactionType) ? 1
                  : 0
                return { amount: new Decimal(t.amount).mul(sign), date: new Date(t.transactionDate) }
              })
              .filter(c => !c.amount.isZero())
            if (cashflows.length >= 1) {
              cashflows.push({ amount: equity, date: new Date() })
              try { rentalXirr = calculateXirr(cashflows) } catch { /* insufficient data */ }
            }
          }

          const cashflowByYear = isRental ? groupByYear(txs) : []

          const sectionTitle = propertyType === 'primary_residence'
            ? 'Eigen woning'
            : propertyType === 'rental'
            ? 'Verhuurappartement'
            : 'Vastgoed'

          return (
            <section key={summary.id} className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">{sectionTitle}</h2>
                  {detail.realEstateDetails?.address && (
                    <p className="text-sm text-muted-foreground">{detail.realEstateDetails.address}</p>
                  )}
                </div>
                <Link
                  href={`/assets/${summary.id}`}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Details →
                </Link>
              </div>

              {/* KPI cards */}
              <div className={`grid grid-cols-1 gap-4 ${isRental ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
                {!isRental ? (
                  <>
                    <KpiCard
                      label="Woningwaarde"
                      value={storedValue.gt(0) ? formatCurrency(storedValue.toNumber()) : '—'}
                      subtext={latestValuation ? `Peildatum: ${latestValuation.valuationDate}` : 'Geen valuatie opgeslagen'}
                    />
                    <KpiCard
                      label="Hypotheek"
                      value={mortgage.gt(0) ? formatCurrency(mortgage.toNumber()) : '—'}
                      subtext={latestMortgage?.lender ?? undefined}
                    />
                    <KpiCard
                      label="Eigen vermogen"
                      value={formatCurrency(equity.toNumber())}
                    />
                  </>
                ) : (
                  <>
                    <KpiCard
                      label="Bruto huurrendement"
                      value={grossRentalYield ? formatPercent(grossRentalYield.toNumber()) : '—'}
                      subtext="Jaarinkomen / pandwaarde — bruto, excl. belasting"
                    />
                    <KpiCard
                      label="Netto huurrendement"
                      value={netRentalYield ? formatPercent(netRentalYield.toNumber()) : '—'}
                      subtext="Na exploitatiekosten — bruto, excl. belasting"
                    />
                    <KpiCard
                      label="Cash-on-cash rendement"
                      value={cashOnCash ? formatPercent(cashOnCash.toNumber()) : '—'}
                      subtext="Op eigen inleg excl. hypotheek — bruto, excl. belasting"
                    />
                    <KpiCard
                      label="Totaalrendement"
                      value={rentalXirr ? formatPercent(rentalXirr.toNumber()) : '—'}
                      subtext="Jaarlijks rendement incl. waardeontwikkeling — bruto, excl. belasting"
                      trend={rentalXirr ? { value: formatPercent(rentalXirr.toNumber()), positive: rentalXirr.gt(0) } : undefined}
                    />
                  </>
                )}
              </div>

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

              {/* Cashflow verhuur per jaar */}
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
            </section>
          )
        })}

      </main>
    </>
  )
}
