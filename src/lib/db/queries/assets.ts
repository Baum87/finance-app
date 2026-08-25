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
  calculateRealizedGain,
  buildXirrCashflows,
  hasMinimumXirrPeriod,
} from '@/lib/finance'
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
            limit: 10,
          },
        },
      },
      valuations: {
        orderBy: [desc(assetValuations.valuationDate)],
        limit: 12,
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
  brokerId?: string | null
  accountType?: string | null
  sector?: string | null
  instrumentType?: string | null
}

export type CryptoInput = {
  kind: 'crypto'
  ticker?: string | null
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
  street?: string | null
  postalCode?: string | null
  city?: string | null
  propertyType: string
  // Nullable: simpele invoer vult geen aankoopprijs/-datum in.
  purchasePrice?: string | null
  purchaseCosts: string
  purchaseDate?: string | null
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

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

const LIQUID_ASSET_TYPES = new Set(['stock_etf', 'crypto', 'savings'])

/**
 * Schrijft de asset-rij + bijbehorende detail-tabel + lege tax_metadata weg
 * binnen een gegeven transactie. Gedeeld door createAsset() (gedetailleerde
 * flow, via Server Action) en createSimpleAsset() (snel-invoerflow) zodat de
 * per-type insertlogica niet dubbel onderhouden hoeft te worden.
 */
async function insertAssetWithDetails(
  tx: Tx,
  tenantId: string,
  base: { name: string; assetType: AssetType; currency: string },
  d: AssetDetailsInput,
) {
  const [asset] = await tx
    .insert(assets)
    .values({
      tenantId,
      name: base.name,
      assetType: base.assetType,
      currency: base.currency,
      isLiquid: LIQUID_ASSET_TYPES.has(base.assetType),
    })
    .returning()

  switch (d.kind) {
    case 'stock_etf':
      await tx.insert(stockEtfDetails).values({
        assetId: asset.id,
        ticker: d.ticker,
        isin: d.isin ?? null,
        brokerId: d.brokerId ?? null,
        accountType: d.accountType ?? 'taxable',
        sector: d.sector ?? null,
        instrumentType: d.instrumentType ?? 'stock',
      })
      break
    case 'crypto':
      await tx.insert(cryptoDetails).values({
        assetId: asset.id,
        ticker: d.ticker ?? null,
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
        street: d.street ?? null,
        postalCode: d.postalCode ?? null,
        city: d.city ?? null,
        propertyType: d.propertyType,
        purchasePrice: d.purchasePrice ?? null,
        purchaseCosts: d.purchaseCosts,
        purchaseDate: d.purchaseDate ?? null,
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
}

export async function createAsset(userId: string, data: CreateAssetInput) {
  const tenantId = await getOrCreateTenant(userId)
  return db.transaction(async (tx) => insertAssetWithDetails(tx, tenantId, data, data.details))
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
          .set({ ticker: d.ticker, isin: d.isin ?? null, brokerId: d.brokerId ?? null, accountType: d.accountType ?? 'taxable', sector: d.sector ?? null, instrumentType: d.instrumentType ?? 'stock' })
          .where(eq(stockEtfDetails.assetId, assetId))
        break
      case 'crypto':
        await tx
          .update(cryptoDetails)
          .set({ ticker: d.ticker ?? null, walletOrExchange: d.walletOrExchange ?? null })
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
            street: d.street ?? null,
            postalCode: d.postalCode ?? null,
            city: d.city ?? null,
            propertyType: d.propertyType,
            purchasePrice: d.purchasePrice ?? null,
            purchaseCosts: d.purchaseCosts,
            purchaseDate: d.purchaseDate ?? null,
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

export async function updateSavingsMonthlyDeposit(userId: string, assetId: string, amount: string) {
  const tenantId = await getOrCreateTenant(userId)
  const [asset] = await db
    .select({ id: assets.id })
    .from(assets)
    .where(and(eq(assets.id, assetId), eq(assets.tenantId, tenantId)))
    .limit(1)
  if (!asset) throw new Error('Asset niet gevonden of geen toegang')

  await db
    .update(savingsDetails)
    .set({ monthlyDepositAmount: amount })
    .where(eq(savingsDetails.assetId, assetId))
}

export async function deleteAsset(userId: string, assetId: string) {
  const tenantId = await getOrCreateTenant(userId)
  await db
    .update(assets)
    .set({ isActive: false, updatedAt: new Date() })
    .where(and(eq(assets.id, assetId), eq(assets.tenantId, tenantId)))
}

// ─── Import matching ──────────────────────────────────────────────────────────

export type IsinMatch = { assetId: string; isin: string; ticker: string; name: string }

/**
 * Matcht ISIN's uit een xlsx-import tegen bestaande actieve stock_etf-posities
 * van de tenant. Gebruikt door lib/services/import — bepaalt welke rijen naar
 * een bestaande positie gaan vs. een nieuwe positie nodig hebben.
 */
export async function findStockEtfAssetsByIsins(userId: string, isins: string[]): Promise<IsinMatch[]> {
  if (isins.length === 0) return []
  const tenantId = await getOrCreateTenant(userId)
  const rows = await db
    .select({ assetId: assets.id, isin: stockEtfDetails.isin, ticker: stockEtfDetails.ticker, name: assets.name })
    .from(assets)
    .innerJoin(stockEtfDetails, eq(stockEtfDetails.assetId, assets.id))
    .where(and(
      eq(assets.tenantId, tenantId),
      eq(assets.assetType, 'stock_etf'),
      eq(assets.isActive, true),
      inArray(stockEtfDetails.isin, isins),
    ))
  return rows.filter((r): r is IsinMatch => r.isin !== null)
}

// ─── Calculated values ────────────────────────────────────────────────────────

export type AssetCalculations = {
  currentValue: Decimal
  netDeposit: Decimal
  unrealizedGain: Decimal
  xirr: Decimal | null
  quantityHeld: Decimal | null
  /** Gerealiseerd resultaat (AVCO) uit sells tot nu toe. Alleen relevant voor stock_etf/crypto, anders null. */
  realizedGain: Decimal | null
  fetchedPrice: Decimal | null
  priceCurrency: string | null
  priceEur: Decimal | null
  priceStatus?: 'live' | 'fallback' | 'unavailable'
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
    fees: t.fees ?? '0',
  }))

  const netDeposit = calculateNetDeposit(txs)

  let currentValue = new Decimal(0)
  let fetchedPrice: Decimal | null = null
  let priceCurrency: string | null = null
  let priceEurCalc: Decimal | null = null
  let quantityHeld: Decimal | null = null
  let realizedGain: Decimal | null = null
  let priceStatus: 'live' | 'fallback' | 'unavailable' | undefined = undefined

  const assetType = asset.assetType

  if (assetType === 'stock_etf' || assetType === 'crypto') {
    // Onafhankelijk van live-koersophaling: quantityHeld/realizedGain zijn puur
    // afgeleid van transacties, dus ook beschikbaar (bijv. voor een gesloten
    // positie) als de koers niet op te halen is.
    quantityHeld = calculateQuantityHeld(txs)
    realizedGain = calculateRealizedGain(txRows)

    const ticker =
      assetType === 'stock_etf'
        ? asset.stockEtfDetails?.ticker
        : asset.cryptoDetails?.ticker

    if (ticker) {
      try {
        const priceResult = await getLatestPrice(ticker)
        fetchedPrice = priceResult.price
        priceCurrency = priceResult.currency

        let priceEur: Decimal
        if (priceResult.currency === 'EUR') {
          priceEur = priceResult.price
        } else {
          // Gooit een fout als FX niet beschikbaar — valt door naar valuation-fallback
          const fx = await getLatestPrice(`${priceResult.currency}EUR=X`)
          priceEur = priceResult.price.times(fx.price)
        }

        priceEurCalc = priceEur
        currentValue = calculateMarketValue(txs, priceEur)
        priceStatus = 'live'
      } catch {
        // Live koers niet beschikbaar — priceStatus geeft de UI een expliciet signaal
        console.error(`[prices] Koersophaling gefaald voor ${ticker}`)
        const latestVal = asset.valuations?.[0]
        if (latestVal) {
          currentValue = new Decimal(latestVal.value)
          priceStatus = 'fallback'
        } else {
          // currentValue blijft 0 — priceStatus='unavailable' onderscheidt dit van een echte nulwaarde
          priceStatus = 'unavailable'
        }
      }
    } else {
      // Geen ticker (simpele invoer, bv. crypto zonder live koers) — huidige
      // waarde komt direct uit de laatst ingevoerde waardering.
      const latestVal = asset.valuations?.[0]
      if (latestVal) {
        currentValue = new Decimal(latestVal.value)
        priceStatus = 'fallback'
      } else {
        priceStatus = 'unavailable'
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

  // XIRR: bron van waarheid conform finance-logic.md §6 — zie lib/finance/xirr-cashflows.ts
  let xirr: Decimal | null = null
  const cashflows = buildXirrCashflows(txRows)

  if (cashflows.length >= 1 && currentValue.gt(0) && hasMinimumXirrPeriod(cashflows)) {
    cashflows.push({ amount: currentValue, date: new Date() })
    try {
      xirr = calculateXirr(cashflows)
    } catch {
      xirr = null
    }
  }

  return {
    asset,
    calculations: { currentValue, netDeposit, unrealizedGain, xirr, quantityHeld, realizedGain, fetchedPrice, priceCurrency, priceEur: priceEurCalc, priceStatus },
  }
}

export type AssetWithValue = AssetWithDetails & {
  currentValue: Decimal
  priceStatus?: 'live' | 'fallback' | 'unavailable'
  /** Alleen gezet voor stock_etf/crypto — anders null (geen quantity-gebaseerde positie). */
  quantityHeld: Decimal | null
  /** Gerealiseerd resultaat (AVCO) uit sells tot nu toe. Alleen relevant voor stock_etf/crypto, anders null. */
  realizedGain: Decimal | null
}

/**
 * Returns all active assets with their current value for the list view.
 * Fetches prices for stock_etf and crypto in parallel; uses balance/valuation for others.
 */
export async function getAssetsWithValues(userId: string): Promise<AssetWithValue[]> {
  const allAssets = await getAssets(userId)

  const results = await Promise.all(
    allAssets.map(async (asset) => {
      let currentValue = new Decimal(0)
      let quantityHeld: Decimal | null = null
      let realizedGain: Decimal | null = null

      const txRows = await db
        .select({
          transactionType: transactions.transactionType,
          amount: transactions.amount,
          quantity: transactions.quantity,
          fees: transactions.fees,
        })
        .from(transactions)
        .where(eq(transactions.assetId, asset.id))
        .orderBy(asc(transactions.transactionDate))

      const txs = txRows.map(t => ({
        transactionType: t.transactionType,
        amount: t.amount,
        quantity: t.quantity,
      }))

      let priceStatus: 'live' | 'fallback' | 'unavailable' | undefined = undefined

      if (asset.assetType === 'stock_etf' || asset.assetType === 'crypto') {
        // Onafhankelijk van live-koersophaling: puur afgeleid van transacties,
        // dus ook beschikbaar voor een gesloten (volledig verkochte) positie.
        quantityHeld = calculateQuantityHeld(txs)
        realizedGain = calculateRealizedGain(txRows)

        const ticker =
          asset.assetType === 'stock_etf'
            ? asset.stockEtfDetails?.ticker
            : asset.cryptoDetails?.ticker

        if (ticker) {
          try {
            const priceResult = await getLatestPrice(ticker)
            let priceEur: Decimal
            if (priceResult.currency === 'EUR') {
              priceEur = priceResult.price
            } else {
              const fx = await getLatestPrice(`${priceResult.currency}EUR=X`)
              priceEur = priceResult.price.times(fx.price)
            }
            currentValue = calculateMarketValue(txs, priceEur)
            priceStatus = 'live'
          } catch {
            console.error(`[prices] Koersophaling gefaald voor ${ticker}`)
            const latestVal = asset.valuations?.[0]
            if (latestVal) {
              currentValue = new Decimal(latestVal.value)
              priceStatus = 'fallback'
            } else {
              priceStatus = 'unavailable'
            }
          }
        } else {
          const latestVal = asset.valuations?.[0]
          if (latestVal) {
            currentValue = new Decimal(latestVal.value)
            priceStatus = 'fallback'
          } else {
            priceStatus = 'unavailable'
          }
        }
      } else if (asset.assetType === 'savings') {
        currentValue = calculateSavingsBalance(txs)
      } else {
        const latestVal = asset.valuations?.[0]
        if (latestVal) currentValue = new Decimal(latestVal.value)
      }

      return { ...asset, currentValue, priceStatus, quantityHeld, realizedGain }
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
        fees: t.fees ?? '0',
      }))

      const netDeposit = calculateNetDeposit(txs)
      const unrealizedGain = calculateUnrealizedGain(asset.currentValue, netDeposit)

      // XIRR: bron van waarheid conform finance-logic.md §6 — zie lib/finance/xirr-cashflows.ts
      let xirr: Decimal | null = null
      const cashflows = buildXirrCashflows(txRows)
      if (cashflows.length >= 1 && asset.currentValue.gt(0) && hasMinimumXirrPeriod(cashflows)) {
        cashflows.push({ amount: asset.currentValue, date: new Date() })
        try { xirr = calculateXirr(cashflows) } catch { /* niet genoeg data */ }
      }

      return { id: asset.id, name: asset.name, assetType: asset.assetType, currentValue: asset.currentValue, netDeposit, unrealizedGain, xirr }
    }),
  )
}

/**
 * Returns latest mortgage balance per asset (map: assetId → balance).
 * Falls back to originalAmount when no balance has been recorded yet,
 * so net worth is never silently under-reported.
 */
export async function getMortgageBalancesMap(userId: string): Promise<Map<string, Decimal>> {
  const tenantId = await getOrCreateTenant(userId)

  const mortgageRows = await db
    .select({
      assetId:        mortgages.assetId,
      originalAmount: mortgages.originalAmount,
    })
    .from(mortgages)
    .innerJoin(assets, eq(assets.id, mortgages.assetId))
    .where(eq(assets.tenantId, tenantId))

  if (mortgageRows.length === 0) return new Map()

  const balanceRows = await db
    .select({
      assetId:            mortgages.assetId,
      outstandingBalance: mortgageBalances.outstandingBalance,
    })
    .from(mortgages)
    .innerJoin(assets, eq(assets.id, mortgages.assetId))
    .innerJoin(mortgageBalances, eq(mortgageBalances.mortgageId, mortgages.id))
    .where(eq(assets.tenantId, tenantId))
    .orderBy(desc(mortgageBalances.balanceDate))

  const latestBalance = new Map<string, Decimal>()
  for (const row of balanceRows) {
    if (!latestBalance.has(row.assetId)) {
      latestBalance.set(row.assetId, new Decimal(row.outstandingBalance))
    }
  }

  const map = new Map<string, Decimal>()
  for (const row of mortgageRows) {
    map.set(row.assetId, latestBalance.get(row.assetId) ?? new Decimal(row.originalAmount))
  }
  return map
}

export async function getCryptoWallets(userId: string): Promise<string[]> {
  const tenantId = await getOrCreateTenant(userId)
  const rows = await db
    .select({ wallet: cryptoDetails.walletOrExchange })
    .from(cryptoDetails)
    .innerJoin(assets, eq(assets.id, cryptoDetails.assetId))
    .where(and(eq(assets.tenantId, tenantId), eq(assets.isActive, true)))
  return [...new Set(rows.map(r => r.wallet).filter((w): w is string => !!w))]
}
