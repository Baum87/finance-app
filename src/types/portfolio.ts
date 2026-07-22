export type PortfolioConfig = {
  assetType: 'stock_etf' | 'crypto'
  groupField: 'broker' | 'walletOrExchange'
  emptyGroupLabel: string
  showChart: boolean
  showAllocation: boolean
  detailBasePath: string
  pageTitle: string
  sectionTitle: string
  newAssetHref: string
  newAssetLabel: string
  /** Secundaire actie naast newAssetHref, bijv. "+ Broker toevoegen" (optioneel). */
  secondaryActionHref?: string
  secondaryActionLabel?: string
  /** Basispad voor groep-detailpagina's (bijv. broker-detail). Alleen zetten als die pagina bestaat. */
  groupDetailBasePath?: string
  emptyMessage: string
}

export const STOCK_ETF_CONFIG: PortfolioConfig = {
  assetType: 'stock_etf',
  groupField: 'broker',
  emptyGroupLabel: 'Overig',
  showChart: true,
  showAllocation: true,
  detailBasePath: '/portfolio/aandelen-etf',
  pageTitle: 'Aandelen & ETF\'s',
  sectionTitle: 'Brokers',
  newAssetHref: '/assets/new?type=stock_etf&from=/portfolio/aandelen-etf',
  newAssetLabel: '+ Nieuwe positie',
  secondaryActionHref: '/portfolio/aandelen-etf/broker/new',
  secondaryActionLabel: '+ Broker toevoegen',
  groupDetailBasePath: '/portfolio/aandelen-etf/broker',
  emptyMessage: 'Nog geen posities toegevoegd.',
}

export const CRYPTO_CONFIG: PortfolioConfig = {
  assetType: 'crypto',
  groupField: 'walletOrExchange',
  emptyGroupLabel: 'Overig',
  showChart: true,
  showAllocation: false,
  detailBasePath: '/portfolio/crypto',
  pageTitle: 'Crypto',
  sectionTitle: 'Crypto posities',
  newAssetHref: '/portfolio/crypto/new',
  newAssetLabel: '+ Nieuwe crypto',
  emptyMessage: 'Nog geen crypto posities toegevoegd.',
}
