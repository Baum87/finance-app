import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/db/supabase-server'
import { getAssetWithCalculations } from '@/lib/db/queries/assets'
import { getTransactions } from '@/lib/db/queries/transactions'
import { getBrokers } from '@/lib/db/queries/brokers'
import { TransactionList } from '@/components/assets/TransactionList'
import { ValuationForm } from '@/components/assets/ValuationForm'
import { ValuationHistory } from '@/components/assets/ValuationHistory'
import { MortgageBalanceForm } from '@/components/assets/MortgageBalanceForm'
import { MortgageBalanceHistory } from '@/components/assets/MortgageBalanceHistory'
import { createValuationAction, createMortgageBalanceAction } from '@/app/assets/actions'
import { Topbar } from '@/components/layout/Topbar'
import { formatCurrency } from '@/lib/utils/format'

const ASSET_TYPE_LABELS: Record<string, string> = {
  stock_etf:   'Aandeel / ETF',
  crypto:      'Crypto',
  savings:     'Spaarrekening',
  real_estate: 'Vastgoed',
  pension:     'Pensioen',
  vordering:   'Vordering',
}

// Asset types where value comes from stored valuations
const VALUATION_TYPES = ['savings', 'real_estate', 'pension']

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div className="flex justify-between py-2 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  )
}

function KpiCard({
  label, value, sub, accent,
}: {
  label: string
  value: string
  sub?: string
  accent?: 'positive' | 'negative'
}) {
  const valueClass =
    accent === 'positive' ? 'text-[var(--color-sage)]'
    : accent === 'negative' ? 'text-[var(--color-terracotta)]'
    : 'text-foreground'
  return (
    <div className="rounded-3xl border border-border bg-card p-6">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`mt-3 text-2xl font-semibold ${valueClass}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}


export default async function AssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [result, txList, brokerList] = await Promise.all([
    getAssetWithCalculations(user!.id, id),
    getTransactions(user!.id, id),
    getBrokers(user!.id),
  ])

  if (!result) notFound()

  const { asset, calculations } = result
  const { currentValue, netDeposit, unrealizedGain, xirr, quantityHeld, fetchedPrice, priceCurrency, priceEur } = calculations

  const fmtPct = (v: number) =>
    new Intl.NumberFormat('nl-NL', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(v)

  const fmtKoers = (v: number) =>
    new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(v)

  const gainAccent = unrealizedGain.gt(0) ? 'positive' : unrealizedGain.lt(0) ? 'negative' : undefined
  const showValuationSection = VALUATION_TYPES.includes(asset.assetType)
  const mortgagesWithBalances = asset.mortgages ?? []

  return (
    <>
      <Topbar />
      <main className="mx-auto max-w-[1200px] px-8 py-12 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <Link href="/assets" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              ← Portfolio
            </Link>
            <h1 className="mt-3 text-2xl font-semibold text-foreground">{asset.name}</h1>
            <span className="mt-1 inline-block text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
              {ASSET_TYPE_LABELS[asset.assetType] ?? asset.assetType}
            </span>
          </div>
          <Link
            href={`/assets/${asset.id}/edit`}
            className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            Bewerken
          </Link>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Huidige waarde"
            value={currentValue.gt(0) ? formatCurrency(currentValue.toNumber()) : '—'}
            sub={priceEur ? `Koers: ${fmtKoers(priceEur.toNumber())}` : undefined}
          />
          <KpiCard
            label="Ingelegd"
            value={formatCurrency(netDeposit.toNumber())}
          />
          <KpiCard
            label="Rendement (totaal)"
            value={currentValue.gt(0) ? formatCurrency(unrealizedGain.toNumber()) : '—'}
            sub={currentValue.gt(0) && netDeposit.gt(0)
              ? fmtPct(unrealizedGain.div(netDeposit).toNumber())
              : undefined}
            accent={gainAccent}
          />
          <KpiCard
            label="Rendement"
            value={xirr ? fmtPct(xirr.toNumber()) : '—'}
            sub={xirr ? 'Jaarlijks, berekend via XIRR' : 'Te weinig data'}
            accent={xirr?.gt(0) ? 'positive' : xirr?.lt(0) ? 'negative' : undefined}
          />
        </div>

        {/* Quantity / price row for stock/crypto */}
        {quantityHeld && (
          <div className="grid grid-cols-2 gap-4">
            <KpiCard label="Aantal in bezit" value={quantityHeld.toFixed(8).replace(/\.?0+$/, '')} />
            <KpiCard label="Transacties" value={String(txList.length)} />
          </div>
        )}

        {/* Waardering invoeren — savings, real_estate, pension */}
        {showValuationSection && (
          <div className="rounded-3xl border border-border bg-card p-6 space-y-4">
            <ValuationForm
              assetId={asset.id}
              currency={asset.currency}
              action={createValuationAction}
              label={
                asset.assetType === 'savings'
                  ? 'Huidig saldo registreren'
                  : asset.assetType === 'pension'
                  ? 'Pensioenwaarde registreren'
                  : 'Marktwaarde registreren'
              }
            />
            <ValuationHistory assetId={asset.id} valuations={asset.valuations ?? []} />
          </div>
        )}

        {/* Hypotheeksaldo bijwerken — alleen voor real_estate met hypotheek */}
        {mortgagesWithBalances.map(mortgage => (
          <div key={mortgage.id} className="rounded-3xl border border-border bg-card p-6 space-y-4">
            <MortgageBalanceForm
              assetId={asset.id}
              mortgageId={mortgage.id}
              lender={mortgage.lender}
              originalAmount={mortgage.originalAmount}
              interestRate={mortgage.interestRate}
              endDate={mortgage.endDate}
              action={createMortgageBalanceAction}
            />
            <MortgageBalanceHistory
              assetId={asset.id}
              originalAmount={mortgage.originalAmount}
              balances={mortgage.balances ?? []}
            />
          </div>
        ))}

        {/* Asset details */}
        <div className="rounded-3xl border border-border bg-card p-6">
          <p className="text-sm font-medium text-foreground mb-4">Details</p>
          {asset.stockEtfDetails && (
            <>
              <DetailRow label="Ticker" value={asset.stockEtfDetails.ticker} />
              <DetailRow label="ISIN" value={asset.stockEtfDetails.isin} />
              <DetailRow label="Broker" value={brokerList.find(b => b.id === asset.stockEtfDetails!.brokerId)?.name ?? null} />
              <DetailRow label="Accounttype" value={asset.stockEtfDetails.accountType} />
            </>
          )}
          {asset.cryptoDetails && (
            <>
              <DetailRow label="Symbol" value={asset.cryptoDetails.ticker} />
              <DetailRow label="Wallet / Exchange" value={asset.cryptoDetails.walletOrExchange} />
            </>
          )}
          {asset.savingsDetails && (
            <>
              <DetailRow label="Bank" value={asset.savingsDetails.bankName} />
              <DetailRow label="Type" value={asset.savingsDetails.accountType} />
              <DetailRow label="Rente" value={asset.savingsDetails.interestRate ? `${asset.savingsDetails.interestRate}%` : null} />
            </>
          )}
          {asset.pensionDetails && (
            <>
              <DetailRow label="Aanbieder" value={asset.pensionDetails.provider} />
              <DetailRow label="Type" value={asset.pensionDetails.pensionType} />
              <DetailRow label="Verwachte jaaruitkering" value={asset.pensionDetails.projectedAnnualBenefit} />
            </>
          )}
          {asset.realEstateDetails && (
            <>
              <DetailRow label="Adres" value={asset.realEstateDetails.address} />
              <DetailRow label="Type" value={asset.realEstateDetails.propertyType} />
              <DetailRow label="Aankoopprijs" value={asset.realEstateDetails.purchasePrice} />
              <DetailRow label="WOZ-waarde" value={asset.realEstateDetails.wozValue} />
              <DetailRow label="Aankoopdatum" value={asset.realEstateDetails.purchaseDate} />
            </>
          )}
        </div>

        {/* Transacties */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Transacties</h2>
            <Link
              href={`/assets/${asset.id}/transactions/new`}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
            >
              + Transactie
            </Link>
          </div>
          <TransactionList transactions={txList} assetId={asset.id} />
        </div>

      </main>
    </>
  )
}
