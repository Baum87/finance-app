import { and, eq, desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { liabilities } from '@/lib/db/schema'
import { getOrCreateTenant } from './tenant'

export type LiabilityInput = {
  name: string
  liabilityType: string
  amount: string
  interestRate?: string | null
  startDate?: string | null
  endDate?: string | null
  currency?: string
}

export async function getLiabilities(userId: string) {
  const tenantId = await getOrCreateTenant(userId)
  return db
    .select()
    .from(liabilities)
    .where(and(eq(liabilities.tenantId, tenantId), eq(liabilities.isActive, true)))
    .orderBy(desc(liabilities.createdAt))
}

export type Liability = Awaited<ReturnType<typeof getLiabilities>>[number]

export async function createLiability(userId: string, data: LiabilityInput) {
  const tenantId = await getOrCreateTenant(userId)
  const [row] = await db
    .insert(liabilities)
    .values({
      tenantId,
      name:          data.name,
      liabilityType: data.liabilityType,
      amount:        data.amount,
      interestRate:  data.interestRate ?? null,
      startDate:     data.startDate ?? null,
      endDate:       data.endDate ?? null,
      currency:      data.currency ?? 'EUR',
    })
    .returning()
  return row
}

export async function deleteLiability(userId: string, liabilityId: string) {
  const tenantId = await getOrCreateTenant(userId)
  await db
    .update(liabilities)
    .set({ isActive: false })
    .where(and(eq(liabilities.id, liabilityId), eq(liabilities.tenantId, tenantId)))
}
