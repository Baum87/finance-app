import { and, eq, desc, asc, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  assets, tenantUsers, stockEtfDetails, cryptoDetails,
  savingsDetails, pensionDetails, realEstateDetails, vorderingDetails,
  mortgages, mortgageBalances, assetValuations, transactions, assetTaxMetadata,
} from '@/lib/db/schema'
import type { AssetType } from '@/types'
import Decimal from 'decimal.js'
import { getLatestPrice } from '@/lib/services/prices'
import {
  calculateNetDeposit,
  calculateXirr,
  calculateMarketValue,
  calculateSavingsBalance,
  calculateUnrealizedGain,
  calculateQuantityHeld,
} from '@/lib/finance'
import type { Cashflow } from '@/lib/finance'
import { getOrCreateTenant } from './tenant'

export async function getAssets(userId: string) {
  const tenantId = await getOrCreateTenant(userId)
  return db.query.assets.findMany({
    where: and(eq(assets.tenantId, tenantId), eq(assets.isActive, true)),
    with: {
      stockEtfDetails: true,
      cryptoDetails: true,
      savingsDetails: true,
      pensionDetails: true,
      realEstateDetails: true,
      vorderingDetails: true,
      valuations: {
        orderBy: [desc(assetValuations.valuationDate)],
        limit: 1,
      },
    },
    orderBy: [asc(assets.createdAt)],
  })
}

export type AssetWithDetails = Awaited<ReturnType<typeof getAssets>>[number]

export async function getAsset(userId: string, assetId: string) {
  const tenantId = await getOrCreateTenant(userId)
  return db.query.assets.findFirst({
    where: and(
      eq(assets.id, assetId),
      eq(assets.tenantId, tenantId),
      eq(assets.isActive, true),
    ),
    with: {
      stockEtfDetails: true,
      cryptoDetails: true,
      savingsDetails: true,
      pensionDetails: true,
      realEstateDetails: true,
      vorderingDetails: true,
      mortgages: {
        with: {
          balances: {
            orderBy: [desc(mortgageBalances.balanceDate)],
            limit: 1,
          },
        },
      },
      valuations: {
        orderBy: [desc(assetValuations.valuationDate)],
        limit: 5,
      },
    },
  })
}

export type AssetDetail = NonNullable<Awaited<ReturnType<typeof getAsset>>>

// ─── Detail types ─────────────────────────────────────────────────────────────

export type StockEtfInput = {
  kind: 'stock_etf'
  ticker: string
  isin?: string | null
  broker?: string | null
  accountType?: string | null
  sector?: string | null
  instrumentType?: string | null
}

export type CryptoInput = {
  kind: 'crypto'
  ticker: string
  walletOrExchange?: string | null
}

export type SavingsInput = {
  kind: 'savings'
  bankName: string
  accountType?: string | null
  interestRate?: string | null
}

export type PensionInput = {
  kind: 'pension'
  provider: string
  pensionType: string
  projectedAnnualBenefit?: string | null
}

export type RealEstateInput = {
  kind: 'real_estate'
  address?: string | null
  propertyType: string
  purchasePrice: string
  purchaseCosts: string
  purchaseDate: string
  wozValue?: string | null
  mortgage?: {
    lender: string
    originalAmount: string
    interestRate: string
    startDate: string
    mortgageType: string
  } | null
}

export type VorderingInput = {
  kind: 'vordering'
  counterparty: string
  principalAmount: string
  interestRate?: string | null
  startDate?: string | null
  endDate?: string | null
  loanType?: string | null
}

export type AssetDetailsInput =
  | StockEtfInput
  | CryptoInput
  | SavingsInput
  | PensionInput
  | RealEstateInput
  | VorderingInput

export type CreateAssetInput = {
  name: string
  assetType: AssetType
  currency: string
  details: AssetDetailsInput
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function createAsset(userId: string, data: CreateAssetInput) {
  const tenantId = await getOrCreateTenant(userId)

  return db.transaction(async (tx) => {
    const LIQUID_ASSET_TYPES = new Set(['stock_etf', 'crypto', 'savings'])
    const [asset] = await tx
      .insert(assets)
      .values({
        tenantId,
        name: data.name,
        assetType: data.assetType,
        currency: data.currency,
        isLiquid: LIQUID_ASSET_TYPES.has(data.assetType),
      })
      .returning()

    const d = data.details
    switch (d.kind) {
      case 'stock_etf':
        await tx.insert(stockEtfDetails).values({
          assetId: asset.id,
          ticker: d.ticker,
          isin: d.isin ?? null,
          broker: d.broker ?? null,
          accountType: d.accountType ?? 'taxable',
          sector: d.sector ?? null,
          instrumentType: d.instrumentType ?? 'stock',
        })
        break
      case 'crypto':
        await tx.insert(cryptoDetails).values({
          assetId: asset.id,
          ticker: d.ticker,
          walletOrExchange: d.walletOrExchange ?? null,
        })
        break
      case 'savings':
        await tx.insert(savingsDetails).values({
          assetId: asset.id,
          bankName: d.bankName,
          accountType: d.accountType ?? 'savings',
          interestRate: d.interestRate ?? null,
        })
        break
      case 'pension':
        await tx.insert(pensionDetails).values({
          assetId: asset.id,
          provider: d.provider,
          pensionType: d.pensionType,
          projectedAnnualBenefit: d.projectedAnnualBenefit ?? null,
        })
        break
      case 'real_estate':
        await tx.insert(realEstateDetails).values({
          assetId: asset.id,
          address: d.address ?? null,
          propertyType: d.propertyType,
          purchasePrice: d.purchasePrice,
          purchaseCosts: d.purchaseCosts,
          purchaseDate: d.purchaseDate,
          wozValue: d.wozValue ?? null,
        })
        if (d.mortgage) {
          await tx.insert(mortgages).values({
            assetId: asset.id,
            lender: d.mortgage.lender,
            originalAmount: d.mortgage.originalAmount,
            interestRate: d.mortgage.interestRate,
            startDate: d.mortgage.startDate,
            mortgageType: d.mortgage.mortgageType,
          })
        }
        break
      case 'vordering':
        await tx.insert(vorderingDetails).values({
          assetId: asset.id,
          counterparty: d.counterparty,
          principalAmount: d.principalAmount,
          interestRate: d.interestRate ?? null,
          startDate: d.startDate ?? null,
          endDate: d.endDate ?? null,
          loanType: d.loanType ?? 'family',
        })
        break
    }

    // Altijd een leeg tax_metadata record aanmaken (conform data-model.md)
    await tx.insert(assetTaxMetadata).values({ assetId: asset.id, box: 3 })

    return asset
  })
}

export async function updateAsset(
  userId: string,
  assetId: string,
  data: { name: string; currency: string; details: AssetDetailsInput },
) {
  const tenantId = await getOrCreateTenant(userId)

  return db.transaction(async (tx) => {
    const [asset] = await tx
      .update(assets)
      .set({ name: data.name, currency: data.currency, updatedAt: new Date() })
      .where(and(eq(assets.id, assetId), eq(assets.tenantId, tenantId)))
      .returning()

    if (!asset) throw new Error('Asset niet gevonden')

    const d = data.details
    switch (d.kind) {
      case 'stock_etf':
        await tx
          .update(stockEtfDetails)
          .set({ ticker: d.ticker, isin: d.isin ?? null, broker: d.broker ?? null, accountType: d.accountType ?? 'taxable', sector: d.sector ?? null, instrumentType: d.instrumentType ?? 'stock' })
          .where(eq(stockEtfDetails.assetId, assetId))
        break
      case 'crypto':
        await tx
          .update(cryptoDetails)
          .set({ ticker: d.ticker, walletOrExchange: d.walletOrExchange ?? null })
          .where(eq(cryptoDetails.assetId, assetId))
        break
      case 'savings':
        await tx
          .update(savingsDetails)
          .set({ bankName: d.bankName, accountType: d.accountType ?? 'savings', interestRate: d.interestRate ?? null })
          .where(eq(savingsDetails.assetId, assetId))
        break
      case 'pension':
        await tx
          .update(pensionDetails)
          .set({ provider: d.provider, pensionType: d.pensionType, projectedAnnualBenefit: d.projectedAnnualBenefit ?? null })
          .where(eq(pensionDetails.assetId, assetId))
        break
      case 'real_estate':
        await tx
          .update(realEstateDetails)
          .set({
            address: d.address ?? null,
            propertyType: d.propertyType,
            purchasePrice: d.purchasePrice,
            purchaseCosts: d.purchaseCosts,
            purchaseDate: d.purchaseDate,
            wozValue: d.wozValue ?? null,
          })
          .where(eq(realEstateDetails.assetId, assetId))
        break
      case 'vordering':
        await tx
          .update(vorderingDetails)
          .set({
            counterparty: d.counterparty,
            principalAmount: d.principalAmount,
            interestRate: d.interestRate ?? null,
            startDate: d.startDate ?? null,
            endDate: d.endDate ?? null,
            loanType: d.loanType ?? 'family',
          })
          .where(eq(vorderingDetails.assetId, assetId))
        break
    }

    return asset
  })
}

export async function deleteAsset(userId: string, assetId: string) {
  const tenantId = await getOrCreateTenant(userId)
  await db
    .update(assets)
    .set({ isActive: false, updatedAt: new Date() })
    .where(and(eq(assets.id, assetId), eq(assets.tenantId, tenantId)))
}

// ─── Calculated values ────────────────────────────────────────────────────────

export type AssetCalculations = {
  currentValue: Decimal
  netDeposit: Decimal
  unrealizedGain: Decimal
  xirr: Decimal | null
  quantityHeld: Decimal | null
  fetchedPrice: Decimal | null
  priceCurrency: string | null
  priceEur: Decimal | null
}

/**
 * Returns a single asset with live calculations: current value, XIRR, net deposit.
 * For stock_etf and crypto: fetches live price from Yahoo Finance.
 * For savings: sums deposits/withdrawals.
 * For real_estate/pension: uses latest valuation.
 */
export async function getAssetWithCalculations(
  userId: string,
  assetId: string,
): Promise<{ asset: AssetDetail; calculations: AssetCalculations } | null> {
  const asset = await getAsset(userId, assetId)
  if (!asset) return null

  const txRows = await db
    .select()
    .from(transactions)
    .where(eq(transactions.assetId, assetId))
    .orderBy(asc(transactions.transactionDate))

  const txs = txRows.map(t => ({
    transactionType: t.transactionType,
    amount: t.amount,
    quantity: t.quantity,
    transactionDate: t.transactionDate,
  }))

  const netDeposit = calculateNetDeposit(txs)

  let currentValue = new Decimal(0)
  let fetchedPrice: Decimal | null = null
  let priceCurrency: string | null = null
  let priceEurCalc: Decimal | null = null
  let quantityHeld: Decimal | null = null

  const assetType = asset.assetType

  if (assetType === 'stock_etf' || assetType === 'crypto') {
    const ticker =
      assetType === 'stock_etf'
        ? asset.stockEtfDetails?.ticker
        : asset.cryptoDetails?.ticker

    if (ticker) {
      try {
        const priceResult = await getLatestPrice(ticker)
        fetchedPrice = priceResult.price
        priceCurrency = priceResult.currency

        let priceEur = priceResult.price
        if (priceResult.currency !== 'EUR') {
          try {
            const fx = await getLatestPrice(`${priceResult.currency}EUR=X`)
            priceEur = priceResult.price.times(fx.price)
          } catch { /* FX niet beschikbaar, gebruik native prijs */ }
        }

        priceEurCalc = priceEur
        currentValue = calculateMarketValue(txs, priceEur)
        quantityHeld = calculateQuantityHeld(txs)
      } catch {
        // price fetch failed — fall back to latest valuation
        const latestVal = asset.valuations?.[0]
        if (latestVal) currentValue = new Decimal(latestVal.value)
      }
    }
  } else if (assetType === 'savings') {
    currentValue = calculateSavingsBalance(txs)
  } else {
    // real_estate or pension: use latest stored valuation
    const latestVal = asset.valuations?.[0]
    if (latestVal) currentValue = new Decimal(latestVal.value)
  }

  const unrealizedGain = calculateUnrealizedGain(currentValue, netDeposit)

  // XIRR: all cashflow types conform finance-logic.md §6
  const XIRR_OUTFLOWS = new Set(['buy', 'deposit', 'cost'])
  const XIRR_INFLOWS  = new Set(['sell', 'withdrawal', 'dividend', 'interest', 'rental_income'])
  let xirr: Decimal | null = null
  const cashflows: Cashflow[] = txRows
    .filter(t => XIRR_OUTFLOWS.has(t.transactionType) || XIRR_INFLOWS.has(t.transactionType))
    .map(t => {
      const sign = XIRR_OUTFLOWS.has(t.transactionType) ? -1 : 1
      return { amount: new Decimal(t.amount).mul(sign), date: new Date(t.transactionDate) }
    })

  const MS_PER_DAY = 1000 * 60 * 60 * 24
  const XIRR_MIN_DAYS = 30

  if (cashflows.length >= 1 && currentValue.gt(0)) {
    const firstDate = cashflows.reduce((min, cf) =>
      cf.date.getTime() < min.getTime() ? cf.date : min, cashflows[0].date)
    const daysSinceFirst = (Date.now() - firstDate.getTime()) / MS_PER_DAY

    if (daysSinceFirst >= XIRR_MIN_DAYS) {
      cashflows.push({ amount: currentValue, date: new Date() })
      try {
        xirr = calculateXirr(cashflows)
      } catch {
        xirr = null
      }
    }
  }

  return {
    asset,
    calculations: { currentValue, netDeposit, unrealizedGain, xirr, quantityHeld, fetchedPrice, priceCurrency, priceEur: priceEurCalc },
  }
}

export type AssetWithValue = AssetWithDetails & { currentValue: Decimal }

/**
 * Returns all active assets with their current value for the list view.
 * Fetches prices for stock_etf and crypto in parallel; uses balance/valuation for others.
 */
export async function getAssetsWithValues(userId: string): Promise<AssetWithValue[]> {
  const allAssets = await getAssets(userId)

  const results = await Promise.all(
    allAssets.map(async (asset) => {
      let currentValue = new Decimal(0)

      const txRows = await db
        .select({ transactionType: transactions.transactionType, amount: transactions.amount, quantity: transactions.quantity })
        .from(transactions)
        .where(eq(transactions.assetId, asset.id))

      const txs = txRows.map(t => ({
        transactionType: t.transactionType,
        amount: t.amount,
        quantity: t.quantity,
      }))

      if (asset.assetType === 'stock_etf' || asset.assetType === 'crypto') {
        const ticker =
          asset.assetType === 'stock_etf'
            ? asset.stockEtfDetails?.ticker
            : asset.cryptoDetails?.ticker

        if (ticker) {
          try {
            const priceResult = await getLatestPrice(ticker)
            let priceEur = priceResult.price
            if (priceResult.currency !== 'EUR') {
              try {
                const fx = await getLatestPrice(`${priceResult.currency}EUR=X`)
                priceEur = priceResult.price.times(fx.price)
              } catch { /* FX niet beschikbaar, gebruik native prijs */ }
            }
            currentValue = calculateMarketValue(txs, priceEur)
          } catch {
            const latestVal = asset.valuations?.[0]
            if (latestVal) currentValue = new Decimal(latestVal.value)
          }
        }
      } else if (asset.assetType === 'savings') {
        currentValue = calculateSavingsBalance(txs)
      } else {
        const latestVal = asset.valuations?.[0]
        if (latestVal) currentValue = new Decimal(latestVal.value)
      }

      return { ...asset, currentValue }
    }),
  )

  return results
}

// ─── Portfolio calculations ───────────────────────────────────────────────────

const LIQUID_TYPES = ['stock_etf', 'crypto', 'savings'] as const

export type PortfolioAssetRow = {
  id: string
  name: string
  assetType: string
  currentValue: Decimal
  netDeposit: Decimal
  unrealizedGain: Decimal
  xirr: Decimal | null
}

/**
 * Returns all liquid assets (stock_etf, crypto, savings) with full calculations
 * for the Vermogen dashboard table.
 */
export async function getLiquidAssetsWithCalculations(userId: string): Promise<PortfolioAssetRow[]> {
  const allAssets = await getAssetsWithValues(userId)
  const liquidAssets = allAssets.filter(a => (LIQUID_TYPES as readonly string[]).includes(a.assetType))

  return Promise.all(
    liquidAssets.map(async (asset) => {
      const txRows = await db
        .select()
        .from(transactions)
        .where(eq(transactions.assetId, asset.id))
        .orderBy(asc(transactions.transactionDate))

      const txs = txRows.map(t => ({
        transactionType: t.transactionType,
        amount: t.amount,
        quantity: t.quantity,
        transactionDate: t.transactionDate,
      }))

      const netDeposit = calculateNetDeposit(txs)
      const unrealizedGain = calculateUnrealizedGain(asset.currentValue, netDeposit)

      // Build XIRR cashflows
      let xirr: Decimal | null = null
      if (asset.currentValue.gt(0)) {
        const cashflows: Cashflow[] = txRows
          .filter(t => ['buy', 'sell', 'deposit', 'withdrawal'].includes(t.transactionType))
          .map(t => {
            const sign = t.transactionType === 'buy' || t.transactionType === 'deposit' ? -1 : 1
            return { amount: new Decimal(t.amount).mul(sign), date: new Date(t.transactionDate) }
          })
        if (cashflows.length >= 1) {
          cashflows.push({ amount: asset.currentValue, date: new Date() })
          try { xirr = calculateXirr(cashflows) } catch { /* not enough data */ }
        }
      }

      return { id: asset.id, name: asset.name, assetType: asset.assetType, currentValue: asset.currentValue, netDeposit, unrealizedGain, xirr }
    }),
  )
}

/**
 * Returns latest mortgage balance per asset (map: assetId → balance).
 * Used to compute net worth including real estate liabilities.
 */
export async function getMortgageBalancesMap(userId: string): Promise<Map<string, Decimal>> {
  const tenantId = await getOrCreateTenant(userId)

  const rows = await db
    .select({
      assetId:            mortgages.assetId,
      outstandingBalance: mortgageBalances.outstandingBalance,
      balanceDate:        mortgageBalances.balanceDate,
    })
    .from(mortgages)
    .innerJoin(assets, eq(assets.id, mortgages.assetId))
    .innerJoin(mortgageBalances, eq(mortgageBalances.mortgageId, mortgages.id))
    .where(eq(assets.tenantId, tenantId))
    .orderBy(desc(mortgageBalances.balanceDate))

  // Keep only the latest balance per asset
  const map = new Map<string, Decimal>()
  for (const row of rows) {
    if (!map.has(row.assetId)) {
      map.set(row.assetId, new Decimal(row.outstandingBalance))
    }
  }
  return map
}
