import { and, eq, desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { oneTimeExpenses } from '@/lib/db/schema'
import { getOrCreateTenant } from './tenant'

export type OneTimeExpenseInput = {
  name: string
  amount: string
  expenseDate: string
  isShared: boolean
}

export async function getOneTimeExpenses(userId: string) {
  const tenantId = await getOrCreateTenant(userId)
  return db
    .select()
    .from(oneTimeExpenses)
    .where(eq(oneTimeExpenses.tenantId, tenantId))
    .orderBy(desc(oneTimeExpenses.expenseDate))
}

export type OneTimeExpense = Awaited<ReturnType<typeof getOneTimeExpenses>>[number]

export async function createOneTimeExpense(userId: string, data: OneTimeExpenseInput) {
  const tenantId = await getOrCreateTenant(userId)
  const [row] = await db
    .insert(oneTimeExpenses)
    .values({ tenantId, name: data.name, amount: data.amount, expenseDate: data.expenseDate, isShared: data.isShared })
    .returning()
  return row
}

export async function updateOneTimeExpense(userId: string, expenseId: string, data: OneTimeExpenseInput) {
  const tenantId = await getOrCreateTenant(userId)
  await db
    .update(oneTimeExpenses)
    .set({ name: data.name, amount: data.amount, expenseDate: data.expenseDate, isShared: data.isShared, updatedAt: new Date() })
    .where(and(eq(oneTimeExpenses.id, expenseId), eq(oneTimeExpenses.tenantId, tenantId)))
}

export async function deleteOneTimeExpense(userId: string, expenseId: string) {
  const tenantId = await getOrCreateTenant(userId)
  await db
    .delete(oneTimeExpenses)
    .where(and(eq(oneTimeExpenses.id, expenseId), eq(oneTimeExpenses.tenantId, tenantId)))
}
