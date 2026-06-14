import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { brokers } from '@/lib/db/schema'
import { getOrCreateTenant } from './tenant'

export async function getBrokers(userId: string) {
  const tenantId = await getOrCreateTenant(userId)
  return db
    .select({ id: brokers.id, name: brokers.name, createdAt: brokers.createdAt })
    .from(brokers)
    .where(eq(brokers.tenantId, tenantId))
    .orderBy(brokers.name)
}

export async function createBroker(userId: string, name: string) {
  const tenantId = await getOrCreateTenant(userId)
  const [row] = await db
    .insert(brokers)
    .values({ tenantId, name: name.trim() })
    .returning()
  return row
}

export async function deleteBroker(userId: string, brokerId: string) {
  const tenantId = await getOrCreateTenant(userId)
  const row = await db
    .select({ id: brokers.id })
    .from(brokers)
    .where(and(eq(brokers.id, brokerId), eq(brokers.tenantId, tenantId)))
    .limit(1)
  if (!row[0]) throw new Error('Broker niet gevonden')
  await db.delete(brokers).where(eq(brokers.id, brokerId))
}
