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
  newAssetHref: '/portfolio/aandelen-etf/broker/new',
  newAssetLabel: '+ Broker toevoegen',
  emptyMessage: 'Nog geen brokers toegevoegd.',
}

export const CRYPTO_CONFIG: PortfolioConfig = {
  assetType: 'crypto',
  groupField: 'walletOrExchange',
  emptyGroupLabel: 'Overig',
  showChart: false,
  showAllocation: false,
  detailBasePath: '/portfolio/crypto',
  pageTitle: 'Crypto',
  sectionTitle: 'Crypto posities',
  newAssetHref: '/assets/new?type=crypto&from=/portfolio/crypto',
  newAssetLabel: '+ Nieuwe crypto',
  emptyMessage: 'Nog geen crypto posities toegevoegd.',
}
