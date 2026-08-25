import Decimal from 'decimal.js'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/db/supabase-server'
import { getAssetsWithValues, getMortgageBalancesMap } from '@/lib/db/queries/assets'
import { getNetWorthAtDate } from '@/lib/db/queries/cashflow'
import { getLiabilities } from '@/lib/db/queries/liabilities'
import {
  getStockEtfEntries, getCryptoEntries, getPensionEntries, getSavingsEntries, getRealEstateEntries, latestPerGroup,
} from '@/lib/db/queries/simple-entries'
import { calculateNetWorth, calculateAllocation } from '@/lib/finance'
import { formatCurrency } from '@/lib/utils/format'
import { Topbar } from '@/components/layout/Topbar'

const ASSET_TYPE_LABELS: Record<string, string> = {
  stock_etf:   'Aandelen & ETF',
  crypto:      'Crypto',
  savings:     'Spaargeld',
  real_estate: 'Vastgoed',
  pension:     'Pensioen',
  vordering:   'Vorderingen',
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Goedemorgen'
  if (hour < 18) return 'Goedemiddag'
  return 'Goedenavond'
}

export default async function OverzichtPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  const monthAgoDate = new Date()
  monthAgoDate.setDate(monthAgoDate.getDate() - 30)
  const monthAgoStr = monthAgoDate.toISOString().slice(0, 10)

  const [assets, mortgageMap, netWorthMonthAgo, stockEtfEntries, cryptoEntries, pensionEntries, savingsEntries, realEstateEntries, liabilities] = await Promise.all([
    getAssetsWithValues(user!.id),
    getMortgageBalancesMap(user!.id),
    getNetWorthAtDate(user!.id, monthAgoStr),
    getStockEtfEntries(user!.id),
    getCryptoEntries(user!.id),
    getPensionEntries(user!.id),
    getSavingsEntries(user!.id),
    getRealEstateEntries(user!.id),
    getLiabilities(user!.id),
  ])

  const totalLiabilities = liabilities.reduce((s, l) => s.plus(l.amount), new Decimal(0))

  // Eenvoudige invoerlijsten (crypto/pensioen/spaarrekening/vastgoed): som van
  // de meest recente rij per broker/bank/adres — zie simple-entries.ts.
  const sumLatestPerGroup = <T,>(rows: T[], keyFn: (r: T) => string, valueFn: (r: T) => string) =>
    latestPerGroup(rows, keyFn).reduce((s, r) => s.plus(new Decimal(valueFn(r))), new Decimal(0))

  const stockEtfValue    = sumLatestPerGroup(stockEtfEntries, e => e.broker, e => e.currentValue)
  const cryptoValue      = sumLatestPerGroup(cryptoEntries, e => e.broker, e => e.currentValue)
  const pensionValue     = sumLatestPerGroup(pensionEntries, e => e.broker, e => e.currentValue)
  const savingsValue     = sumLatestPerGroup(savingsEntries, e => e.bank, e => e.balance)
  const realEstateValue  = sumLatestPerGroup(realEstateEntries, e => `${e.street}|${e.postalCode}|${e.city}`, e => e.wozValue)

  const simpleCategories = [
    { assetType: 'stock_etf',   value: stockEtfValue,   liquid: true },
    { assetType: 'crypto',      value: cryptoValue,     liquid: true },
    { assetType: 'pension',     value: pensionValue,    liquid: false },
    { assetType: 'savings',     value: savingsValue,    liquid: true },
  ].filter(c => c.value.gt(0))

  // Vastgoed geeft een vertekend beeld in "Netto vermogen" (grote, illiquide
  // klap) — apart gehouden en los getoond i.p.v. meegeteld.
  const nonRealEstateAssets = assets.filter(a => a.assetType !== 'real_estate')
  const realEstateAssetsValue = assets
    .filter(a => a.assetType === 'real_estate')
    .reduce((sum, a) => sum.plus(a.currentValue).minus(mortgageMap.get(a.id) ?? new Decimal(0)), new Decimal(0))
  const realEstateTotal = realEstateAssetsValue.plus(realEstateValue)

  const assetNetWorth = calculateNetWorth(
    nonRealEstateAssets.map(a => ({
      value: a.currentValue,
      liability: mortgageMap.get(a.id) ?? new Decimal(0),
    })),
  ).plus(simpleCategories.reduce((sum, c) => sum.plus(c.value), new Decimal(0)))

  // Schulden uit /schulden (studielening, persoonlijke lening e.d.) hebben geen
  // historische waarde-tracking zoals hypotheken (mortgage_balances) — alleen het
  // huidige bedrag. Ze tellen daarom wel mee in het headline netto vermogen,
  // maar niet in de 30-dagen-delta hieronder (die blijft asset-gebaseerd).
  const netWorth = assetNetWorth.minus(totalLiabilities)

  const illiquidAssets = nonRealEstateAssets.filter(a => !a.isLiquid)
  const illiquidSimpleCategories = simpleCategories.filter(c => !c.liquid)
  const illiquidNetValue = illiquidAssets
    .reduce((sum, a) => sum.plus(a.currentValue).minus(mortgageMap.get(a.id) ?? new Decimal(0)), new Decimal(0))
    .plus(illiquidSimpleCategories.reduce((sum, c) => sum.plus(c.value), new Decimal(0)))
  const illiquidLabel = [...new Set([
    ...illiquidAssets.map(a => a.assetType),
    ...illiquidSimpleCategories.map(c => c.assetType),
  ])]
    .map(t => (ASSET_TYPE_LABELS[t] ?? t).toLowerCase())
    .join(', ')

  const delta = netWorthMonthAgo != null ? assetNetWorth.minus(netWorthMonthAgo) : null
  const deltaPositive = delta?.gte(0) ?? true
  const deltaStr = delta
    ? `${deltaPositive ? '+' : ''}${formatCurrency(delta.toNumber())}`
    : null

  const allocationSlices = calculateAllocation([
    ...nonRealEstateAssets.map(a => ({ assetType: a.assetType, value: a.currentValue })),
    ...simpleCategories.map(c => ({ assetType: c.assetType, value: c.value })),
  ])
  const biggest = allocationSlices.sort((x, y) => y.value.minus(x.value).toNumber())[0]
  const biggestLabel  = biggest ? (ASSET_TYPE_LABELS[biggest.assetType] ?? biggest.assetType) : null
  const biggestPct    = biggest ? biggest.percentage.toNumber().toFixed(0) : null

  const firstName =
    (user?.user_metadata?.full_name as string | undefined)?.split(' ')[0]
    ?? user?.email?.split('@')[0]
    ?? ''

  return (
    <>
      <Topbar />
      <main className="mx-auto max-w-[1200px] px-8 py-12 space-y-6">

        {/* Blok 1 — Hero */}
        <section className="py-4">
          <h1 className="text-[clamp(2rem,4vw,3rem)] font-semibold text-foreground leading-tight">
            {getGreeting()}{firstName ? `, ${firstName}` : ''}
          </h1>
          <p className="mt-2 text-lg font-light text-muted-foreground">
            Jouw financiële overzicht van vandaag.
          </p>
        </section>

        {/* Blok 2 — Inzichtkaart */}
        <div className="bg-card border border-border rounded-3xl p-6 space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">Netto vermogen</p>
            <p className="mt-1 text-3xl font-semibold text-foreground">
              {netWorth.gt(0) ? formatCurrency(netWorth.toNumber()) : '—'}
            </p>
            {deltaStr && (
              <p className={`mt-0.5 text-sm font-medium ${deltaPositive ? 'text-sage' : 'text-terracotta'}`}>
                {deltaStr} afgelopen 30 dagen
              </p>
            )}
            {illiquidNetValue.gt(0) && (
              <p className="mt-0.5 text-sm text-muted-foreground">
                waarvan {formatCurrency(illiquidNetValue.toNumber())} illiquide ({illiquidLabel})
              </p>
            )}
            {totalLiabilities.gt(0) && (
              <p className="mt-0.5 text-sm text-muted-foreground">
                waarvan −{formatCurrency(totalLiabilities.toNumber())} schulden (<Link href="/schulden" className="underline hover:opacity-70">bekijk</Link>)
              </p>
            )}
            {realEstateTotal.gt(0) && (
              <p className="mt-0.5 text-sm text-muted-foreground">
                Vastgoed apart: {formatCurrency(realEstateTotal.toNumber())} (niet meegeteld in netto vermogen)
              </p>
            )}
          </div>

          {(nonRealEstateAssets.length > 0 || simpleCategories.length > 0) && (
            <ul className="space-y-1 text-sm text-foreground">
              {biggestLabel && biggestPct && (
                <li className="before:content-['•'] before:mr-2 before:text-muted-foreground">
                  Grootste positie: {biggestLabel} ({biggestPct}% van je vermogen)
                </li>
              )}
              {delta != null && (
                <li className="before:content-['•'] before:mr-2 before:text-muted-foreground">
                  Vermogen {deltaPositive ? 'gegroeid' : 'gedaald'} t.o.v. 30 dagen geleden
                </li>
              )}
              {nonRealEstateAssets.length === 0 && simpleCategories.length === 0 && (
                <li className="text-muted-foreground italic">Voeg assets en waarderingen toe om inzichten te zien.</li>
              )}
            </ul>
          )}

          <div className="flex justify-end">
            <Link
              href="/cashflow"
              className="text-sm font-medium text-[var(--color-blue-brand)] hover:opacity-70 transition-opacity"
            >
              Bekijk details →
            </Link>
          </div>
        </div>

        {/* Blok 3 — Actief doel (placeholder — doelen-datamodel volgt in Sprint 4) */}
        <div className="bg-card border border-border rounded-3xl p-6">
          <p className="text-sm font-medium text-muted-foreground">Actief doel</p>
          <p className="mt-3 text-foreground text-sm">Geen actief doel ingesteld.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Stel hier een spaardoel of vermogensdoel in. Beschikbaar in Sprint 4.
          </p>
        </div>

        {/* Blok 4 — AI Coach */}
        <div className="bg-card border border-border rounded-3xl p-6">
          <p className="text-sm font-medium text-muted-foreground">AI Coach</p>
          <p className="mt-3 text-foreground text-sm">Komt in een volgende versie.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Straks kun je hier vragen stellen over je financiën.
          </p>
        </div>

      </main>
    </>
  )
}
