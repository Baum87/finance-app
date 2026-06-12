import { createServerSupabaseClient } from '@/lib/db/supabase-server'
import { getAssetsWithValues } from '@/lib/db/queries/assets'
import { AssetSection } from '@/components/assets/AssetSection'
import { Topbar } from '@/components/layout/Topbar'
import type { SectionColumn, SectionRow } from '@/components/assets/AssetSection'

type AssetWithValue = Awaited<ReturnType<typeof getAssetsWithValues>>[number]

function toRow(a: AssetWithValue, details: Record<string, string | null>): SectionRow {
  return {
    id: a.id,
    name: a.name,
    currentValue: a.currentValue.toNumber(),
    currency: a.currency,
    details,
  }
}

const STOCK_ETF_COLS: SectionColumn[] = [
  { header: 'Ticker', key: 'ticker' },
  { header: 'Broker', key: 'broker' },
]

const CRYPTO_COLS: SectionColumn[] = [
  { header: 'Symbol', key: 'ticker' },
  { header: 'Exchange / Wallet', key: 'walletOrExchange' },
]

const SAVINGS_COLS: SectionColumn[] = [
  { header: 'Bank', key: 'bankName' },
  { header: 'Rente', key: 'interestRate' },
]

const REAL_ESTATE_COLS: SectionColumn[] = [
  { header: 'Type', key: 'propertyType' },
  { header: 'Adres', key: 'address' },
]

const PENSION_COLS: SectionColumn[] = [
  { header: 'Aanbieder', key: 'provider' },
  { header: 'Type', key: 'pensionType' },
]

const VORDERING_COLS: SectionColumn[] = [
  { header: 'Schuldenaar', key: 'counterparty' },
  { header: 'Rente', key: 'interestRate' },
]

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  primary_residence: 'Eigen woning',
  rental:            'Verhuur',
  vacation:          'Vakantie',
}

const PENSION_TYPE_LABELS: Record<string, string> = {
  defined_benefit:      'Defined benefit',
  defined_contribution: 'Defined contribution',
  annuity:              'Lijfrente',
}

export default async function AssetsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  const assets = await getAssetsWithValues(user!.id)

  const stockRows   = assets.filter(a => a.assetType === 'stock_etf').map(a => toRow(a, {
    ticker: a.stockEtfDetails?.ticker ?? null,
    broker: a.stockEtfDetails?.broker ?? null,
  }))

  const cryptoRows  = assets.filter(a => a.assetType === 'crypto').map(a => toRow(a, {
    ticker:           a.cryptoDetails?.ticker ?? null,
    walletOrExchange: a.cryptoDetails?.walletOrExchange ?? null,
  }))

  const savingsRows = assets.filter(a => a.assetType === 'savings').map(a => toRow(a, {
    bankName:     a.savingsDetails?.bankName ?? null,
    interestRate: a.savingsDetails?.interestRate ? `${a.savingsDetails.interestRate}%` : null,
  }))

  const realEstateRows = assets.filter(a => a.assetType === 'real_estate').map(a => toRow(a, {
    propertyType: PROPERTY_TYPE_LABELS[a.realEstateDetails?.propertyType ?? ''] ?? null,
    address:      a.realEstateDetails?.address ?? null,
  }))

  const pensionRows = assets.filter(a => a.assetType === 'pension').map(a => toRow(a, {
    provider:    a.pensionDetails?.provider ?? null,
    pensionType: PENSION_TYPE_LABELS[a.pensionDetails?.pensionType ?? ''] ?? null,
  }))

  const vorderingRows = assets.filter(a => a.assetType === 'vordering').map(a => toRow(a, {
    counterparty: a.vorderingDetails?.counterparty ?? null,
    interestRate: a.vorderingDetails?.interestRate ? `${a.vorderingDetails.interestRate}%` : null,
  }))

  return (
    <>
      <Topbar />
      <main className="mx-auto max-w-[1200px] px-8 py-12 space-y-10">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Beheer</h1>
          <p className="mt-1 text-sm text-muted-foreground">Overzicht en beheer van al je assets per categorie</p>
        </div>

        <AssetSection
          title="Aandelen & ETFs"
          addLabel="+ Nieuw aandeel/ETF"
          addHref="/assets/new?type=stock_etf"
          columns={STOCK_ETF_COLS}
          rows={stockRows}
        />

        <AssetSection
          title="Crypto"
          addLabel="+ Nieuwe crypto"
          addHref="/assets/new?type=crypto"
          columns={CRYPTO_COLS}
          rows={cryptoRows}
        />

        <AssetSection
          title="Spaarrekeningen"
          addLabel="+ Nieuwe spaarrekening"
          addHref="/assets/new?type=savings"
          columns={SAVINGS_COLS}
          rows={savingsRows}
        />

        <AssetSection
          title="Vastgoed"
          addLabel="+ Nieuw vastgoed"
          addHref="/assets/new?type=real_estate"
          columns={REAL_ESTATE_COLS}
          rows={realEstateRows}
        />

        <AssetSection
          title="Pensioen"
          addLabel="+ Nieuw pensioen"
          addHref="/assets/new?type=pension"
          columns={PENSION_COLS}
          rows={pensionRows}
        />

        <AssetSection
          title="Vorderingen"
          addLabel="+ Nieuwe vordering"
          addHref="/assets/new?type=vordering"
          columns={VORDERING_COLS}
          rows={vorderingRows}
        />
      </main>
    </>
  )
}
