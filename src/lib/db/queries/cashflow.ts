import { and, eq, gte, lte, inArray, desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { transactions, assets, tenantUsers, assetValuations, mortgages, mortgageBalances } from '@/lib/db/schema'
import Decimal from 'decimal.js'

async function getTenantId(userId: string): Promise<string> {
  const rows = await db
    .select({ tenantId: tenantUsers.tenantId })
    .from(tenantUsers)
    .where(and(eq(tenantUsers.userId, userId), eq(tenantUsers.role, 'owner')))
    .limit(1)
  if (!rows[0]) throw new Error('Geen tenant gevonden')
  return rows[0].tenantId
}

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
  const tenantId = await getTenantId(userId)

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
  const tenantId = await getTenantId(userId)

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

  // Get latest mortgage balances on or before the date
  const mortgageRows = await db
    .select({
      assetId:            mortgages.assetId,
      outstandingBalance: mortgageBalances.outstandingBalance,
      balanceDate:        mortgageBalances.balanceDate,
    })
    .from(mortgageBalances)
    .innerJoin(mortgages, eq(mortgages.id, mortgageBalances.mortgageId))
    .innerJoin(assets, eq(assets.id, mortgages.assetId))
    .where(and(eq(assets.tenantId, tenantId), lte(mortgageBalances.balanceDate, date)))
    .orderBy(desc(mortgageBalances.balanceDate))

  const latestMortgage = new Map<string, Decimal>()
  for (const row of mortgageRows) {
    if (!latestMortgage.has(row.assetId)) {
      latestMortgage.set(row.assetId, new Decimal(row.outstandingBalance))
    }
  }

  let netWorth = new Decimal(0)
  for (const [assetId, value] of latestPerAsset) {
    const liability = latestMortgage.get(assetId) ?? new Decimal(0)
    netWorth = netWorth.plus(value).minus(liability)
  }

  return netWorth.toDecimalPlaces(2)
}

/**
 * Returns all transaction dates for liquid assets in a period (for benchmark sub-periods).
 */
export async function getPortfolioTxDates(
  userId: string,
  from: string,
  to: string,
): Promise<Date[]> {
  const tenantId = await getTenantId(userId)

  const rows = await db
    .select({ transactionDate: transactions.transactionDate })
    .from(transactions)
    .innerJoin(assets, eq(assets.id, transactions.assetId))
    .where(
      and(
        eq(assets.tenantId, tenantId),
        gte(transactions.transactionDate, from),
        lte(transactions.transactionDate, to),
      ),
    )

  const uniqueDates = [...new Set(rows.map(r => r.transactionDate))]
  return uniqueDates.map(d => new Date(d)).sort((a, b) => a.getTime() - b.getTime())
}
