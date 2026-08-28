import Decimal from 'decimal.js'
import { createServerSupabaseClient } from '@/lib/db/supabase-server'
import { getAssetsWithValues, getMortgageBalancesMap } from '@/lib/db/queries/assets'
import { getTransactions } from '@/lib/db/queries/transactions'
import { getInvestmentAssumption } from '@/lib/db/queries/investment-assumptions'
import { calculateRentalPeriodCashflowForYear } from '@/lib/finance'
import type { RentalPeriodInput } from '@/lib/finance'
import { formatCurrency } from '@/lib/utils/format'
import { Topbar } from '@/components/layout/Topbar'
import { KpiCard } from '@/components/ui/KpiCard'
import { RealEstatePositionsCard } from '@/components/portfolio/RealEstatePositionsCard'
import { ExpectedReturnForm } from '@/components/portfolio/ExpectedReturnForm'
import { saveInvestmentAssumptionAction } from '@/app/portfolio/investment-assumptions-actions'

export default async function VastgoedPortfolioPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  const currentYear = new Date().getFullYear()
  const currentYearStart = `${currentYear}-01-01`

  const [assets, mortgageMap, investmentAssumption] = await Promise.all([
    getAssetsWithValues(user!.id),
    getMortgageBalancesMap(user!.id),
    getInvestmentAssumption(user!.id, 'real_estate'),
  ])

  const realEstateAssets = assets.filter(a => a.assetType === 'real_estate')

  const positions = await Promise.all(
    realEstateAssets.map(async (a) => {
      const txs = await getTransactions(user!.id, a.id)
      const rentalIncomeThisYear = txs
        .filter(t => t.transactionType === 'rental_income' && t.transactionDate >= currentYearStart)
        .reduce((s, t) => s.plus(t.amount), new Decimal(0))
      const costsThisYear = txs
        .filter(t => t.transactionType === 'cost' && t.transactionDate >= currentYearStart)
        .reduce((s, t) => s.plus(t.amount), new Decimal(0))

      const periods: RentalPeriodInput[] = (a.recurringCashflows ?? []).map(r => ({
        cashflowType: r.cashflowType as RentalPeriodInput['cashflowType'],
        amount: r.amount,
        frequency: r.frequency as RentalPeriodInput['frequency'],
        startDate: r.startDate,
        endDate: r.endDate,
      }))
      const periodTotals = calculateRentalPeriodCashflowForYear(periods, currentYear)

      return {
        id: a.id,
        name: a.name,
        currentValue: a.currentValue.toNumber(),
        wozValue: a.wozValues?.[0]
          ? Number(a.wozValues[0].value)
          : a.realEstateDetails?.wozValue ? Number(a.realEstateDetails.wozValue) : null,
        outstandingMortgage: mortgageMap.get(a.id)?.toNumber() ?? null,
        isRental: a.realEstateDetails?.propertyType === 'rental',
        rentalIncomeThisYear: rentalIncomeThisYear.plus(periodTotals.income).toNumber(),
        costsThisYear: costsThisYear.plus(periodTotals.costs).toNumber(),
      }
    }),
  )

  const totalValue = positions.reduce((s, p) => s.plus(p.currentValue), new Decimal(0))

  return (
    <>
      <Topbar />
      <main className="mx-auto max-w-[1200px] px-8 py-12 space-y-8">

        <div>
          <h1 className="text-2xl font-semibold text-foreground">Vastgoed</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {positions.length} pand{positions.length !== 1 ? 'en' : ''}
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <KpiCard
            label="Totale waarde"
            value={positions.length > 0 ? formatCurrency(totalValue.toNumber()) : '—'}
            subtext="Som van huidige waarde per pand"
          />
          <KpiCard
            label="Panden"
            value={String(positions.length)}
            subtext="Actieve panden"
          />
        </div>

        <ExpectedReturnForm
          action={saveInvestmentAssumptionAction}
          category="real_estate"
          title="Verwacht rendement vastgoed"
          description="Eén aanname voor je hele vastgoedportefeuille (waardestijging, geen hypotheekaflossing) — wordt gebruikt om een vermogensdoel met streefdatum op de startpagina te projecteren."
          defaultValue={investmentAssumption?.expectedAnnualReturn}
        />

        <RealEstatePositionsCard
          positions={positions}
          addHref="/assets/new?type=real_estate&from=/portfolio/vastgoed"
        />

      </main>
    </>
  )
}
