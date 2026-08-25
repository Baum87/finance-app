import { and, eq, gte, lte, inArray, desc, asc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { transactions, assets, assetValuations, mortgages, mortgageBalances } from '@/lib/db/schema'
import Decimal from 'decimal.js'
import { getOrCreateTenant } from './tenant'

export type PassiveIncomeTx = {
  transactionType: string
  amount: string
  transactionDate: string
}

/**
 * Returns all passive income/cost transactions in a date range.
 * Types: dividend, interest, rental_income, cost.
 */
export async function getPassiveIncomeData(
  userId: string,
  from: string,
  to: string,
): Promise<PassiveIncomeTx[]> {
  const tenantId = await getOrCreateTenant(userId)

  const rows = await db
    .select({
      transactionType: transactions.transactionType,
      amount:          transactions.amount,
      transactionDate: transactions.transactionDate,
    })
    .from(transactions)
    .innerJoin(assets, eq(assets.id, transactions.assetId))
    .where(
      and(
        eq(assets.tenantId, tenantId),
        inArray(transactions.transactionType, ['dividend', 'interest', 'rental_income', 'cost']),
        gte(transactions.transactionDate, from),
        lte(transactions.transactionDate, to),
      ),
    )

  return rows
}

/**
 * Net worth at a specific date, based on stored asset_valuations and mortgage_balances.
 * Returns null if no valuations exist at or before the given date.
 */
export async function getNetWorthAtDate(userId: string, date: string): Promise<Decimal | null> {
  const tenantId = await getOrCreateTenant(userId)

  // Get all valuations on or before the date
  const valuationRows = await db
    .select({
      assetId:       assetValuations.assetId,
      valuationDate: assetValuations.valuationDate,
      value:         assetValuations.value,
    })
    .from(assetValuations)
    .innerJoin(assets, eq(assets.id, assetValuations.assetId))
    .where(and(eq(assets.tenantId, tenantId), lte(assetValuations.valuationDate, date)))
    .orderBy(desc(assetValuations.valuationDate))

  if (valuationRows.length === 0) return null

  // Keep latest valuation per asset
  const latestPerAsset = new Map<string, Decimal>()
  for (const row of valuationRows) {
    if (!latestPerAsset.has(row.assetId)) {
      latestPerAsset.set(row.assetId, new Decimal(row.value))
    }
  }

  // All mortgages for this tenant (needed for originalAmount fallback)
  const allMortgageRows = await db
    .select({
      assetId:        mortgages.assetId,
      originalAmount: mortgages.originalAmount,
    })
    .from(mortgages)
    .innerJoin(assets, eq(assets.id, mortgages.assetId))
    .where(eq(assets.tenantId, tenantId))

  // Latest recorded balance on or before the date
  const mortgageBalanceRows = await db
    .select({
      assetId:            mortgages.assetId,
      outstandingBalance: mortgageBalances.outstandingBalance,
    })
    .from(mortgageBalances)
    .innerJoin(mortgages, eq(mortgages.id, mortgageBalances.mortgageId))
    .innerJoin(assets, eq(assets.id, mortgages.assetId))
    .where(and(eq(assets.tenantId, tenantId), lte(mortgageBalances.balanceDate, date)))
    .orderBy(desc(mortgageBalances.balanceDate))

  const latestMortgage = new Map<string, Decimal>()
  for (const row of mortgageBalanceRows) {
    if (!latestMortgage.has(row.assetId)) {
      latestMortgage.set(row.assetId, new Decimal(row.outstandingBalance))
    }
  }
  // Fall back to originalAmount when no balance recorded on or before the date
  for (const row of allMortgageRows) {
    if (!latestMortgage.has(row.assetId)) {
      latestMortgage.set(row.assetId, new Decimal(row.originalAmount))
    }
  }

  let netWorth = new Decimal(0)
  for (const [assetId, value] of latestPerAsset) {
    const liability = latestMortgage.get(assetId) ?? new Decimal(0)
    netWorth = netWorth.plus(value).minus(liability)
  }

  return netWorth.toDecimalPlaces(2)
}

export type ValuationPoint = {
  assetId: string
  valuationDate: string
  value: string
}

export type MortgageBalancePoint = {
  assetId: string
  balanceDate: string
  outstandingBalance: string
}

/**
 * All valuations for a tenant, ordered by date ascending — used for the net worth time series chart.
 */
export async function getValuationTimeSeries(userId: string): Promise<ValuationPoint[]> {
  const tenantId = await getOrCreateTenant(userId)
  return db
    .select({
      assetId:       assetValuations.assetId,
      valuationDate: assetValuations.valuationDate,
      value:         assetValuations.value,
    })
    .from(assetValuations)
    .innerJoin(assets, eq(assets.id, assetValuations.assetId))
    .where(eq(assets.tenantId, tenantId))
    .orderBy(asc(assetValuations.valuationDate))
}

/**
 * All mortgage balance records for a tenant, ordered by date ascending.
 * Used alongside getValuationTimeSeries to build the net worth chart with liabilities.
 */
export async function getMortgageBalanceTimeSeries(userId: string): Promise<MortgageBalancePoint[]> {
  const tenantId = await getOrCreateTenant(userId)
  return db
    .select({
      assetId:            mortgages.assetId,
      balanceDate:        mortgageBalances.balanceDate,
      outstandingBalance: mortgageBalances.outstandingBalance,
    })
    .from(mortgageBalances)
    .innerJoin(mortgages, eq(mortgages.id, mortgageBalances.mortgageId))
    .innerJoin(assets, eq(assets.id, mortgages.assetId))
    .where(eq(assets.tenantId, tenantId))
    .orderBy(asc(mortgageBalances.balanceDate))
}
