import Decimal from 'decimal.js'
import { createServerSupabaseClient } from '@/lib/db/supabase-server'
import { getStockEtfEntries, latestPerGroup, groupBy } from '@/lib/db/queries/simple-entries'
import { getAssetsWithValues } from '@/lib/db/queries/assets'
import { getInvestmentAssumption, getStockAnnualReturns } from '@/lib/db/queries/investment-assumptions'
import { buildSimpleEntryMonthlySeries } from '@/lib/finance'
import { formatCurrency, formatPercent } from '@/lib/utils/format'
import { Topbar } from '@/components/layout/Topbar'
import { KpiCard } from '@/components/ui/KpiCard'
import { EntryLogForm } from '@/components/portfolio/EntryLogForm'
import { EntryLogList } from '@/components/portfolio/EntryLogList'
import { InvestedVsValueChart } from '@/components/portfolio/InvestedVsValueChart'
import { AssetPositionsCard } from '@/components/portfolio/AssetPositionsCard'
import { ExpectedReturnForm } from '@/components/portfolio/ExpectedReturnForm'
import { StockAnnualReturnForm } from '@/components/portfolio/StockAnnualReturnForm'
import { StockAnnualReturnHistory } from '@/components/portfolio/StockAnnualReturnHistory'
import { createStockEtfEntryAction, updateStockEtfEntryAction, deleteStockEtfEntryAction } from '@/app/portfolio/simple-entry-actions'
import {
  saveInvestmentAssumptionAction, createStockAnnualReturnAction,
} from '@/app/portfolio/investment-assumptions-actions'

const FIELDS = [
  { name: 'broker', label: 'Broker' },
  { name: 'invested', label: 'Ingelegd', type: 'number' as const, format: 'currency' as const },
  { name: 'currentValue', label: 'Huidige waarde', type: 'number' as const, format: 'currency' as const },
  { name: 'entryDate', label: 'Datum', type: 'date' as const, format: 'date' as const },
]

export default async function AandelenEtfPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [entries, assets, investmentAssumption, stockAnnualReturns] = await Promise.all([
    getStockEtfEntries(user!.id),
    getAssetsWithValues(user!.id),
    getInvestmentAssumption(user!.id, 'stock_etf'),
    getStockAnnualReturns(user!.id),
  ])
  const latestPerBroker = latestPerGroup(entries, e => e.broker)
  const byBroker = groupBy(entries, e => e.broker)

  const assetPositions = assets
    .filter(a => a.assetType === 'stock_etf')
    .map(a => ({ id: a.id, name: a.name, currentValue: a.currentValue.toNumber() }))

  const totalCurrentValue = latestPerBroker.reduce((s, e) => s.plus(new Decimal(e.currentValue)), new Decimal(0))
  const totalInvested = latestPerBroker.reduce((s, e) => s.plus(new Decimal(e.invested)), new Decimal(0))
  const totalGainLoss = totalCurrentValue.minus(totalInvested)
  const gainLossPct = totalInvested.gt(0) ? totalGainLoss.div(totalInvested) : null
  const monthlySeries = buildSimpleEntryMonthlySeries(entries).map(p => ({
    month: p.month,
    invested: p.invested.toNumber(),
    currentValue: p.currentValue.toNumber(),
  }))

  return (
    <>
      <Topbar />
      <main className="mx-auto max-w-[1200px] px-8 py-12 space-y-8">

        <div>
          <h1 className="text-2xl font-semibold text-foreground">Aandelen &amp; ETF&apos;s</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {entries.length} invoer{entries.length !== 1 ? 'en' : ''} bij {latestPerBroker.length} broker{latestPerBroker.length !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <KpiCard
            label="Huidige waarde"
            value={latestPerBroker.length > 0 ? formatCurrency(totalCurrentValue.toNumber()) : '—'}
            subtext="Som van laatste invoer per broker"
          />
          <KpiCard
            label="Totaal ingelegd"
            value={latestPerBroker.length > 0 ? formatCurrency(totalInvested.toNumber()) : '—'}
            subtext="Som van laatste invoer per broker"
          />
          <KpiCard
            label="Winst / verlies"
            value={latestPerBroker.length > 0
              ? `${totalGainLoss.gte(0) ? '+' : ''}${formatCurrency(totalGainLoss.toNumber())}`
              : '—'}
            subtext="Huidige waarde min ingelegd"
            trend={gainLossPct ? { value: formatPercent(gainLossPct.toNumber()), positive: totalGainLoss.gte(0) } : undefined}
          />
        </div>

        <div>
          <h2 className="text-lg font-semibold text-foreground">Rendementverwachting</h2>
          <p className="mt-1 text-sm text-muted-foreground">Voor je hele aandelen/ETF-portefeuille, niet per los aandeel</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ExpectedReturnForm
            action={saveInvestmentAssumptionAction}
            category="stock_etf"
            title="Verwacht rendement"
            description="Eén aanname voor je hele aandelen/ETF-portefeuille — wordt gebruikt om een vermogensdoel met streefdatum op de startpagina te projecteren (rest van je vermogen blijft in die projectie gelijk)."
            defaultValue={investmentAssumption?.expectedAnnualReturn}
          />
          <StockAnnualReturnForm action={createStockAnnualReturnAction} />
        </div>

        <StockAnnualReturnHistory returns={stockAnnualReturns} />

        <AssetPositionsCard
          positions={assetPositions}
          addHref="/assets/new?type=stock_etf&cancel=/portfolio/aandelen-etf"
          addLabel="+ Aandeel/ETF met transacties toevoegen"
          description="Met koop-/verkoop-/dividendtransacties bijgehouden — voedt rendement (XIRR) en dividendinkomsten"
          backTo="/portfolio/aandelen-etf"
        />

        <p className="text-xs text-muted-foreground -mb-2">
          Snel bijhouden zonder aparte koop-/verkooptransacties? Gebruik de lijst hieronder — alleen
          ingelegd bedrag en huidige waarde, zonder rendement (XIRR) of dividendtracking.
        </p>

        <EntryLogForm
          action={createStockEtfEntryAction}
          fields={[
            { name: 'broker', label: 'Broker', placeholder: 'DEGIRO' },
            { name: 'invested', label: 'Ingelegd bedrag (€)', type: 'number', placeholder: '10000' },
            { name: 'currentValue', label: 'Huidige waarde (€)', type: 'number', placeholder: '11500' },
            { name: 'entryDate', label: 'Datum', type: 'date' },
          ]}
        />

        <InvestedVsValueChart data={monthlySeries} />

        {byBroker.size === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-12 text-center">
            <p className="text-sm text-muted-foreground">Nog geen aandelen/ETF-gegevens ingevoerd.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {[...byBroker.entries()].map(([broker, rows]) => (
              <div key={broker}>
                <h2 className="mb-2 text-sm font-semibold text-foreground">{broker}</h2>
                <EntryLogList
                  fields={FIELDS}
                  updateAction={updateStockEtfEntryAction}
                  deleteAction={deleteStockEtfEntryAction}
                  footerLabel="Huidige waarde"
                  footerValue={formatCurrency(Number(rows[0].currentValue))}
                  rows={rows.map(e => ({
                    id: e.id,
                    broker: e.broker,
                    invested: e.invested,
                    currentValue: e.currentValue,
                    entryDate: e.entryDate,
                  }))}
                />
              </div>
            ))}
          </div>
        )}

      </main>
    </>
  )
}
