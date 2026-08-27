import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { goals } from '@/lib/db/schema'
import { getOrCreateTenant } from './tenant'

export type GoalInput = {
  name: string
  goalType: string
  targetAmount: string | null
  targetDate: string | null
}

export async function getGoal(userId: string) {
  const tenantId = await getOrCreateTenant(userId)
  const [goal] = await db
    .select()
    .from(goals)
    .where(eq(goals.tenantId, tenantId))
    .limit(1)
  return goal ?? null
}

export type Goal = NonNullable<Awaited<ReturnType<typeof getGoal>>>

// Upsert: maar 1 doel per tenant (unique constraint op tenant_id) — bestaat
// er nog geen, dan aanmaken; anders bijwerken. Voorkomt dat de UI onderscheid
// moet maken tussen "aanmaken" en "bewerken".
export async function saveGoal(userId: string, data: GoalInput) {
  const tenantId = await getOrCreateTenant(userId)
  const existing = await getGoal(userId)

  if (existing) {
    const [row] = await db
      .update(goals)
      .set({
        name:         data.name,
        goalType:     data.goalType,
        targetAmount: data.targetAmount,
        targetDate:   data.targetDate,
        updatedAt:    new Date(),
      })
      .where(and(eq(goals.id, existing.id), eq(goals.tenantId, tenantId)))
      .returning()
    return row
  }

  const [row] = await db
    .insert(goals)
    .values({
      tenantId,
      name:         data.name,
      goalType:     data.goalType,
      targetAmount: data.targetAmount,
      targetDate:   data.targetDate,
    })
    .returning()
  return row
}

export async function deleteGoal(userId: string) {
  const tenantId = await getOrCreateTenant(userId)
  await db.delete(goals).where(eq(goals.tenantId, tenantId))
}
