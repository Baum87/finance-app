import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { recurringCashflows, assets } from '@/lib/db/schema'
import { getOrCreateTenant } from './tenant'

type RecurringCashflowInput = {
  cashflowType: string
  amount: string
  frequency: string
  startDate: string
  endDate: string | null
  notes?: string
}

export async function createRecurringCashflow(
  userId: string,
  assetId: string,
  data: RecurringCashflowInput,
) {
  const tenantId = await getOrCreateTenant(userId)

  const asset = await db
    .select({ id: assets.id })
    .from(assets)
    .where(and(eq(assets.id, assetId), eq(assets.tenantId, tenantId)))
    .limit(1)
  if (!asset[0]) throw new Error('Asset niet gevonden')

  const [row] = await db
    .insert(recurringCashflows)
    .values({
      assetId,
      cashflowType: data.cashflowType,
      amount: data.amount,
      frequency: data.frequency,
      startDate: data.startDate,
      endDate: data.endDate,
      notes: data.notes,
    })
    .returning()

  return row
}

export async function updateRecurringCashflow(
  userId: string,
  recurringCashflowId: string,
  data: RecurringCashflowInput,
) {
  const tenantId = await getOrCreateTenant(userId)

  const row = await db
    .select({ id: recurringCashflows.id })
    .from(recurringCashflows)
    .innerJoin(assets, eq(assets.id, recurringCashflows.assetId))
    .where(and(eq(recurringCashflows.id, recurringCashflowId), eq(assets.tenantId, tenantId)))
    .limit(1)
  if (!row[0]) throw new Error('Periode niet gevonden')

  await db
    .update(recurringCashflows)
    .set({
      cashflowType: data.cashflowType,
      amount: data.amount,
      frequency: data.frequency,
      startDate: data.startDate,
      endDate: data.endDate,
      notes: data.notes,
    })
    .where(eq(recurringCashflows.id, recurringCashflowId))
}

export async function deleteRecurringCashflow(userId: string, recurringCashflowId: string) {
  const tenantId = await getOrCreateTenant(userId)

  const row = await db
    .select({ id: recurringCashflows.id })
    .from(recurringCashflows)
    .innerJoin(assets, eq(assets.id, recurringCashflows.assetId))
    .where(and(eq(recurringCashflows.id, recurringCashflowId), eq(assets.tenantId, tenantId)))
    .limit(1)
  if (!row[0]) throw new Error('Periode niet gevonden')

  await db.delete(recurringCashflows).where(eq(recurringCashflows.id, recurringCashflowId))
}
