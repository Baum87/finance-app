import Decimal from 'decimal.js'
import { getAssetsWithValues, getMortgageBalancesMap } from './assets'
import {
  getStockEtfEntries, getCryptoEntries, getPensionEntries, getSavingsEntries, latestPerGroup,
} from './simple-entries'

export type PortfolioCategoryType = 'stock_etf' | 'crypto' | 'savings' | 'real_estate' | 'pension' | 'vordering'

export type PortfolioCategoryTotal = {
  assetType: PortfolioCategoryType
  value: Decimal
  liquid: boolean
}

const LIQUID_TYPES = new Set<PortfolioCategoryType>(['stock_etf', 'crypto', 'savings'])
const CATEGORY_ORDER: PortfolioCategoryType[] = ['stock_etf', 'crypto', 'savings', 'real_estate', 'pension', 'vordering']

/**
 * Waarde per portfolio-categorie, opgeteld over de twee manieren waarop een
 * gebruiker een positie kan vastleggen: volledige "asset"-tracking (met
 * transacties/waarderingen) én de eenvoudige invoerlijsten (stock_etf_entries
 * e.d. — zie simple-entries.ts). Beide tellen mee, anders ontbreekt een deel
 * van iemands vermogen als ze voor de simpele invoer kozen. Vastgoed wordt
 * genetto met de hypotheek en heeft geen simpele-invoer-variant meer (die
 * bood geen rendement/transacties en is uitgefaseerd) — net als vorderingen.
 */
export async function getPortfolioCategoryTotals(userId: string): Promise<PortfolioCategoryTotal[]> {
  const [assets, mortgageMap, stockEtfEntries, cryptoEntries, pensionEntries, savingsEntries] = await Promise.all([
    getAssetsWithValues(userId),
    getMortgageBalancesMap(userId),
    getStockEtfEntries(userId),
    getCryptoEntries(userId),
    getPensionEntries(userId),
    getSavingsEntries(userId),
  ])

  const sumLatestPerGroup = <T,>(rows: T[], keyFn: (r: T) => string, valueFn: (r: T) => string) =>
    latestPerGroup(rows, keyFn).reduce((s, r) => s.plus(new Decimal(valueFn(r))), new Decimal(0))

  const assetTotalByType = (type: PortfolioCategoryType) =>
    assets
      .filter(a => a.assetType === type)
      .reduce((s, a) => s.plus(a.currentValue).minus(mortgageMap.get(a.id) ?? new Decimal(0)), new Decimal(0))

  const totals: Record<PortfolioCategoryType, Decimal> = {
    stock_etf:   assetTotalByType('stock_etf').plus(sumLatestPerGroup(stockEtfEntries, e => e.broker, e => e.currentValue)),
    crypto:      assetTotalByType('crypto').plus(sumLatestPerGroup(cryptoEntries, e => e.broker, e => e.currentValue)),
    savings:     assetTotalByType('savings').plus(sumLatestPerGroup(savingsEntries, e => e.bank, e => e.balance)),
    real_estate: assetTotalByType('real_estate'),
    pension:     assetTotalByType('pension').plus(sumLatestPerGroup(pensionEntries, e => e.broker, e => e.currentValue)),
    vordering:   assetTotalByType('vordering'),
  }

  return CATEGORY_ORDER.map(assetType => ({
    assetType,
    value:  totals[assetType],
    liquid: LIQUID_TYPES.has(assetType),
  }))
}
