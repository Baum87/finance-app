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
  calculateMortgageAmortizationForYear,
  calculateRentalPeriodCashflowForYear,
} from '@/lib/finance'
import type { MortgageType, RentalPeriodInput } from '@/lib/finance'
import { formatCurrency, formatPercent, formatAddress, formatDate } from '@/lib/utils/format'
import { Topbar } from '@/components/layout/Topbar'
import { KpiCard } from '@/components/ui/KpiCard'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { ValuationForm } from '@/components/assets/ValuationForm'
import { ValuationHistory } from '@/components/assets/ValuationHistory'
import { MortgageBalanceForm } from '@/components/assets/MortgageBalanceForm'
import { MortgageBalanceHistory } from '@/components/assets/MortgageBalanceHistory'
import { WozValueForm } from '@/components/assets/WozValueForm'
import { WozValueHistory } from '@/components/assets/WozValueHistory'
import { TransactionList } from '@/components/assets/TransactionList'
import { RecurringCashflowForm } from '@/components/assets/RecurringCashflowForm'
import { RecurringCashflowList } from '@/components/assets/RecurringCashflowList'
import {
  createValuationAction, createMortgageBalanceAction, createWozValueAction, createRecurringCashflowAction,
} from '@/app/assets/actions'
import { DeleteAssetButton } from '@/components/portfolio/DeleteAssetButton'

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  primary_residence: 'Eigen woning',
  rental:            'Verhuurpand',
  vacation:          'Vakantiewoning',
}

const MORTGAGE_TYPE_LABELS: Record<string, string> = {
  annuity:       'Annuïteit',
  linear:        'Lineair',
  interest_only: 'Aflossingsvrij',
}

function monthsBetween(start: Date, end: Date): number {
  return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div className="flex justify-between py-2 border-b border-border/60 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  )
}

// Jaartotalen komen uit twee bronnen die naast elkaar bestaan (bewuste keuze,
// zie stappenplan.md): losse rental_income/cost-transacties (voor incidentele
// of historische posten) plus doorlopende huur/kosten-periodes (voor een
// bedrag dat een tijd lang hetzelfde blijft) — deze tellen gewoon bij elkaar op.
function groupByYear(
  txs: { transactionType: string; amount: string; transactionDate: string }[],
  periods: RentalPeriodInput[],
): { year: number; income: Decimal; costs: Decimal; net: Decimal }[] {
  const years = new Map<number, { income: Decimal; costs: Decimal }>()
  for (const tx of txs) {
    const year = new Date(tx.transactionDate).getFullYear()
    const entry = years.get(year) ?? { income: new Decimal(0), costs: new Decimal(0) }
    if (tx.transactionType === 'rental_income') entry.income = entry.income.plus(new Decimal(tx.amount))
    else if (tx.transactionType === 'cost')    entry.costs = entry.costs.plus(new Decimal(tx.amount))
    years.set(year, entry)
  }

  const currentYear = new Date().getFullYear()
  for (const period of periods) {
    const startYear = new Date(period.startDate).getFullYear()
    const endYear = period.endDate ? new Date(period.endDate).getFullYear() : currentYear
    for (let y = startYear; y <= endYear; y++) {
      if (!years.has(y)) years.set(y, { income: new Decimal(0), costs: new Decimal(0) })
    }
  }

  for (const [year, entry] of years) {
    const periodTotals = calculateRentalPeriodCashflowForYear(periods, year)
    entry.income = entry.income.plus(periodTotals.income)
    entry.costs = entry.costs.plus(periodTotals.costs)
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
  // Valt terug op het oorspronkelijke hypotheekbedrag als er nog geen
  // saldo-snapshot is ingevoerd — zonder deze fallback lijkt een net
  // aangemaakte hypotheek alsof er geen schuld is (zelfde patroon als
  // getMortgageBalancesMap elders in de app).
  const totaleHypotheek = mortgages.reduce((s, m) => {
    const bal = m.balances?.[0]?.outstandingBalance ?? m.originalAmount
    return s.plus(new Decimal(bal))
  }, new Decimal(0))
  const eigenVermogen = calculateEquity(currentValue, totaleHypotheek)
  const ltv = currentValue.gt(0) && totaleHypotheek.gt(0)
    ? calculateLtv(totaleHypotheek, currentValue)
    : null

  const propertyType = asset.realEstateDetails?.propertyType ?? ''
  const isRental = propertyType === 'rental'
  const latestWozValueRow = asset.wozValues?.[0]
  const wozValue = latestWozValueRow
    ? new Decimal(latestWozValueRow.value)
    : asset.realEstateDetails?.wozValue
      ? new Decimal(asset.realEstateDetails.wozValue)
      : null
  const primaryMortgage = mortgages[0]

  // Rente/aflossing dit jaar — puur op basis van de hypotheekvoorwaarden
  // (geen saldo-historie nodig), zie financial-expert.md §3b. Aanname:
  // contractueel schema, geen extra aflossingen — vandaar de disclaimer
  // in de UI hieronder.
  let mortgageAmortization: { interestPaid: Decimal; principalRepaid: Decimal } | null = null
  if (primaryMortgage?.endDate) {
    const termMonths = monthsBetween(new Date(primaryMortgage.startDate), new Date(primaryMortgage.endDate))
    if (termMonths > 0) {
      try {
        mortgageAmortization = calculateMortgageAmortizationForYear(
          {
            type: primaryMortgage.mortgageType as MortgageType,
            originalAmount: new Decimal(primaryMortgage.originalAmount),
            annualInterestRate: new Decimal(primaryMortgage.interestRate).dividedBy(100),
            startDate: new Date(primaryMortgage.startDate),
            termMonths,
          },
          new Date().getFullYear(),
        )
      } catch { /* ongeldige hypotheekvoorwaarden — toon niets i.p.v. crashen */ }
    }
  }

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
  //
  // Gebruikt bewust het laatste jaar mét transacties, niet hardcoded het
  // huidige kalenderjaar — anders staat alles op "—" zodra je nog geen
  // transactie voor het nieuwe jaar hebt ingevoerd, of als je (zoals bij
  // historische/test-invoer) oudere datums gebruikt. Zelfde aanpak als de
  // "Cashflow per jaar"-tabel hieronder, die hier ook op leunt.
  const recurringCashflows = asset.recurringCashflows ?? []
  const periodsForFinance: RentalPeriodInput[] = recurringCashflows.map(r => ({
    cashflowType: r.cashflowType as RentalPeriodInput['cashflowType'],
    amount: r.amount,
    frequency: r.frequency as RentalPeriodInput['frequency'],
    startDate: r.startDate,
    endDate: r.endDate,
  }))
  const cashflowByYear = isRental ? groupByYear(txs, periodsForFinance) : []
  const rentalDataYear = cashflowByYear[0]?.year ?? null
  const annualIncome = cashflowByYear[0]?.income ?? new Decimal(0)
  const annualCosts = cashflowByYear[0]?.costs ?? new Decimal(0)

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
  const cashOnCash = isRental && rentalDataYear && initialInvestment?.gt(0)
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
                subtext={rentalDataYear ? `Jaarinkomen ${rentalDataYear} / pandwaarde` : 'Nog geen huurtransactie ingevoerd'}
              />
              <KpiCard
                label="Netto huurrendement"
                value={netRentalYield ? formatPercent(netRentalYield.toNumber()) : '—'}
                subtext={rentalDataYear ? `Na exploitatiekosten ${rentalDataYear}` : 'Nog geen huurtransactie ingevoerd'}
              />
              <KpiCard
                label="Cash-on-cash"
                value={cashOnCash ? formatPercent(cashOnCash.toNumber()) : '—'}
                subtext={rentalDataYear ? `Op eigen inleg, ${rentalDataYear}` : 'Op eigen inleg excl. hypotheek'}
              />
              <KpiCard
                label="Totaalrendement"
                value={rentalXirr ? formatPercent(rentalXirr.toNumber()) : '—'}
                subtext="Incl. waardeontwikkeling — XIRR"
                trend={rentalXirr ? { value: formatPercent(rentalXirr.toNumber()), positive: rentalXirr.gt(0) } : undefined}
              />
            </div>

            {cashOnCash && totaleHypotheek.gt(0) && (
              <p className="text-xs text-muted-foreground -mt-2">
                Cash-on-cash is hoog door de hypotheekfinanciering — dit vergroot zowel winst als verlies.
              </p>
            )}

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

        {/* Details — WOZ-waarde en hypotheekgegevens */}
        {(wozValue || primaryMortgage) && (
          <div className="bg-card border border-border rounded-3xl p-6">
            <p className="text-sm font-medium text-foreground mb-2">Details</p>
            <DetailRow label="WOZ-waarde" value={wozValue ? formatCurrency(wozValue.toNumber()) : null} />
            {primaryMortgage && (
              <>
                <DetailRow label="Hypotheekverstrekker" value={primaryMortgage.lender} />
                <DetailRow label="Hypotheekrente" value={`${primaryMortgage.interestRate}%`} />
                <DetailRow label="Hypotheekvorm" value={MORTGAGE_TYPE_LABELS[primaryMortgage.mortgageType] ?? primaryMortgage.mortgageType} />
                <DetailRow label="Looptijd tot" value={primaryMortgage.endDate ? formatDate(primaryMortgage.endDate) : null} />
                {mortgageAmortization && (
                  <>
                    <DetailRow label={`Rente ${new Date().getFullYear()} (geschat)`} value={formatCurrency(mortgageAmortization.interestPaid.toNumber())} />
                    <DetailRow label={`Aflossing ${new Date().getFullYear()} (geschat)`} value={formatCurrency(mortgageAmortization.principalRepaid.toNumber())} />
                  </>
                )}
              </>
            )}
            {mortgageAmortization && (
              <p className="mt-3 text-xs text-muted-foreground">
                Rente/aflossing zijn een schatting op basis van je hypotheekvoorwaarden (rente, vorm, looptijd) —
                geen extra aflossingen meegerekend die je buiten dit schema om hebt gedaan.
              </p>
            )}
          </div>
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

        {/* Huur & kosten — doorlopende periodes, alleen verhuur */}
        {isRental && (
          <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
            <RecurringCashflowForm
              assetId={asset.id}
              action={createRecurringCashflowAction}
              redirectTo={`/portfolio/vastgoed/${asset.id}`}
            />
            <RecurringCashflowList items={recurringCashflows} />
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
          <ValuationHistory valuations={asset.valuations ?? []} />
        </div>

        {/* WOZ-waarde bijwerken */}
        <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
          <WozValueForm
            assetId={asset.id}
            action={createWozValueAction}
          />
          <WozValueHistory wozValues={asset.wozValues ?? []} />
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
            <MortgageBalanceHistory originalAmount={mortgage.originalAmount} balances={mortgage.balances ?? []} />
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
          <DeleteAssetButton assetId={asset.id} assetName={asset.name} redirectTo="/portfolio/vastgoed" label="Pand verwijderen" />
        </div>

      </main>
    </>
  )
}
