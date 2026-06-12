import { createServerSupabaseClient } from '@/lib/db/supabase-server'
import { getAssetsWithValues } from '@/lib/db/queries/assets'
import { AssetSection } from '@/components/assets/AssetSection'
import { Topbar } from '@/components/layout/Topbar'
import type { SectionColumn } from '@/components/assets/AssetSection'

type AssetWithValue = Awaited<ReturnType<typeof getAssetsWithValues>>[number]

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

type Config = {
  assetType: string
  title: string
  description: string
  addLabel: string
  columns: SectionColumn[]
  getDetails: (a: AssetWithValue) => Record<string, string | null>
}

export const CONFIGS: Record<string, Config> = {
  'stock_etf': {
    assetType:   'stock_etf',
    title:       'Aandelen & ETFs',
    description: 'Individuele aandelen, ETFs en indexfondsen',
    addLabel:    '+ Nieuw aandeel/ETF',
    columns: [
      { header: 'Ticker',  key: 'ticker' },
      { header: 'Broker',  key: 'broker' },
    ],
    getDetails: a => ({
      ticker: a.stockEtfDetails?.ticker ?? null,
      broker: a.stockEtfDetails?.broker ?? null,
    }),
  },
  'crypto': {
    assetType:   'crypto',
    title:       'Crypto',
    description: 'Cryptocurrency posities',
    addLabel:    '+ Nieuwe crypto',
    columns: [
      { header: 'Symbol',            key: 'ticker' },
      { header: 'Exchange / Wallet', key: 'walletOrExchange' },
    ],
    getDetails: a => ({
      ticker:           a.cryptoDetails?.ticker ?? null,
      walletOrExchange: a.cryptoDetails?.walletOrExchange ?? null,
    }),
  },
  'savings': {
    assetType:   'savings',
    title:       'Spaarrekeningen',
    description: 'Spaarrekeningen, betaalrekeningen en deposito\'s',
    addLabel:    '+ Nieuwe spaarrekening',
    columns: [
      { header: 'Bank',  key: 'bankName' },
      { header: 'Rente', key: 'interestRate' },
    ],
    getDetails: a => ({
      bankName:     a.savingsDetails?.bankName ?? null,
      interestRate: a.savingsDetails?.interestRate ? `${a.savingsDetails.interestRate}%` : null,
    }),
  },
  'real_estate': {
    assetType:   'real_estate',
    title:       'Vastgoed',
    description: 'Eigen woning, verhuurpand en vakantiewoning',
    addLabel:    '+ Nieuw vastgoed',
    columns: [
      { header: 'Type',  key: 'propertyType' },
      { header: 'Adres', key: 'address' },
    ],
    getDetails: a => ({
      propertyType: PROPERTY_TYPE_LABELS[a.realEstateDetails?.propertyType ?? ''] ?? null,
      address:      a.realEstateDetails?.address ?? null,
    }),
  },
  'pension': {
    assetType:   'pension',
    title:       'Pensioen',
    description: 'Werkgeverspensioen, lijfrente en overige pensioenopbouw',
    addLabel:    '+ Nieuw pensioen',
    columns: [
      { header: 'Aanbieder', key: 'provider' },
      { header: 'Type',      key: 'pensionType' },
    ],
    getDetails: a => ({
      provider:    a.pensionDetails?.provider ?? null,
      pensionType: PENSION_TYPE_LABELS[a.pensionDetails?.pensionType ?? ''] ?? null,
    }),
  },
  'vordering': {
    assetType:   'vordering',
    title:       'Vorderingen',
    description: 'Familieleningen en zakelijke vorderingen',
    addLabel:    '+ Nieuwe vordering',
    columns: [
      { header: 'Schuldenaar', key: 'counterparty' },
      { header: 'Rente',       key: 'interestRate' },
    ],
    getDetails: a => ({
      counterparty: a.vorderingDetails?.counterparty ?? null,
      interestRate: a.vorderingDetails?.interestRate ? `${a.vorderingDetails.interestRate}%` : null,
    }),
  },
}

export async function PortfolioPage({ assetType }: { assetType: string }) {
  const config = CONFIGS[assetType]
  if (!config) return null

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  const allAssets = await getAssetsWithValues(user!.id)

  const rows = allAssets
    .filter(a => a.assetType === assetType)
    .map(a => ({
      id:           a.id,
      name:         a.name,
      currentValue: a.currentValue.toNumber(),
      currency:     a.currency,
      details:      config.getDetails(a),
    }))

  return (
    <>
      <Topbar />
      <main className="mx-auto max-w-[1200px] px-8 py-12 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{config.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{config.description}</p>
        </div>

        <AssetSection
          title={config.title}
          addLabel={config.addLabel}
          addHref={`/assets/new?type=${assetType}`}
          columns={config.columns}
          rows={rows}
        />
      </main>
    </>
  )
}
