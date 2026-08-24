import { and, eq, desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { recurringItems } from '@/lib/db/schema'
import { getOrCreateTenant } from './tenant'

export type RecurringItemInput = {
  name: string
  itemType: 'income' | 'expense'
  category: string
  amount: string
  frequency: 'monthly' | 'four_weekly' | 'quarterly' | 'yearly'
}

export async function getRecurringItems(userId: string) {
  const tenantId = await getOrCreateTenant(userId)
  return db
    .select()
    .from(recurringItems)
    .where(and(eq(recurringItems.tenantId, tenantId), eq(recurringItems.isActive, true)))
    .orderBy(desc(recurringItems.createdAt))
}

export type RecurringItem = Awaited<ReturnType<typeof getRecurringItems>>[number]

export async function createRecurringItem(userId: string, data: RecurringItemInput) {
  const tenantId = await getOrCreateTenant(userId)
  const [row] = await db
    .insert(recurringItems)
    .values({
      tenantId,
      name:      data.name,
      itemType:  data.itemType,
      category:  data.category,
      amount:    data.amount,
      frequency: data.frequency,
    })
    .returning()
  return row
}

export async function updateRecurringItem(userId: string, itemId: string, data: RecurringItemInput) {
  const tenantId = await getOrCreateTenant(userId)
  await db
    .update(recurringItems)
    .set({
      name:      data.name,
      itemType:  data.itemType,
      category:  data.category,
      amount:    data.amount,
      frequency: data.frequency,
      updatedAt: new Date(),
    })
    .where(and(eq(recurringItems.id, itemId), eq(recurringItems.tenantId, tenantId)))
}

export async function deleteRecurringItem(userId: string, itemId: string) {
  const tenantId = await getOrCreateTenant(userId)
  await db
    .update(recurringItems)
    .set({ isActive: false })
    .where(and(eq(recurringItems.id, itemId), eq(recurringItems.tenantId, tenantId)))
}
