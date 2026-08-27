import { and, desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { investmentAssumptions, stockAnnualReturns } from '@/lib/db/schema'
import { getOrCreateTenant } from './tenant'

// ─── investment_assumptions (verwacht rendement, 1 rij per tenant) ──────────

export async function getInvestmentAssumption(userId: string) {
  const tenantId = await getOrCreateTenant(userId)
  const [row] = await db
    .select()
    .from(investmentAssumptions)
    .where(eq(investmentAssumptions.tenantId, tenantId))
    .limit(1)
  return row ?? null
}

// Upsert: maar 1 rij per tenant (unique constraint op tenant_id), zelfde
// patroon als saveGoal (queries/goals.ts).
export async function saveInvestmentAssumption(userId: string, expectedAnnualReturn: string) {
  const tenantId = await getOrCreateTenant(userId)
  const existing = await getInvestmentAssumption(userId)

  if (existing) {
    const [row] = await db
      .update(investmentAssumptions)
      .set({ expectedAnnualReturn, updatedAt: new Date() })
      .where(and(eq(investmentAssumptions.id, existing.id), eq(investmentAssumptions.tenantId, tenantId)))
      .returning()
    return row
  }

  const [row] = await db
    .insert(investmentAssumptions)
    .values({ tenantId, expectedAnnualReturn })
    .returning()
  return row
}

// ─── stock_annual_returns (werkelijk rendement per jaar, lijst) ─────────────

export async function getStockAnnualReturns(userId: string) {
  const tenantId = await getOrCreateTenant(userId)
  return db
    .select()
    .from(stockAnnualReturns)
    .where(eq(stockAnnualReturns.tenantId, tenantId))
    .orderBy(desc(stockAnnualReturns.year))
}

export async function createStockAnnualReturn(
  userId: string,
  data: { year: number; returnPct: string },
) {
  const tenantId = await getOrCreateTenant(userId)
  const [row] = await db
    .insert(stockAnnualReturns)
    .values({ tenantId, year: data.year, returnPct: data.returnPct })
    .returning()
  return row
}

export async function updateStockAnnualReturn(
  userId: string,
  id: string,
  data: { year: number; returnPct: string },
) {
  const tenantId = await getOrCreateTenant(userId)

  const row = await db
    .select({ id: stockAnnualReturns.id })
    .from(stockAnnualReturns)
    .where(and(eq(stockAnnualReturns.id, id), eq(stockAnnualReturns.tenantId, tenantId)))
    .limit(1)
  if (!row[0]) throw new Error('Jaarrendement niet gevonden')

  await db
    .update(stockAnnualReturns)
    .set({ year: data.year, returnPct: data.returnPct, updatedAt: new Date() })
    .where(eq(stockAnnualReturns.id, id))
}

export async function deleteStockAnnualReturn(userId: string, id: string) {
  const tenantId = await getOrCreateTenant(userId)

  const row = await db
    .select({ id: stockAnnualReturns.id })
    .from(stockAnnualReturns)
    .where(and(eq(stockAnnualReturns.id, id), eq(stockAnnualReturns.tenantId, tenantId)))
    .limit(1)
  if (!row[0]) throw new Error('Jaarrendement niet gevonden')

  await db.delete(stockAnnualReturns).where(eq(stockAnnualReturns.id, id))
}
