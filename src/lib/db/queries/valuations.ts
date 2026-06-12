import { and, eq, desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { assetValuations, assets, tenantUsers } from '@/lib/db/schema'

async function getTenantId(userId: string): Promise<string> {
  const rows = await db
    .select({ tenantId: tenantUsers.tenantId })
    .from(tenantUsers)
    .where(and(eq(tenantUsers.userId, userId), eq(tenantUsers.role, 'owner')))
    .limit(1)
  if (!rows[0]) throw new Error('Geen tenant gevonden')
  return rows[0].tenantId
}

export async function createValuation(
  userId: string,
  assetId: string,
  data: { valuationDate: string; value: string; currency?: string },
) {
  const tenantId = await getTenantId(userId)

  // Verify asset belongs to this tenant
  const asset = await db
    .select({ id: assets.id })
    .from(assets)
    .where(and(eq(assets.id, assetId), eq(assets.tenantId, tenantId)))
    .limit(1)
  if (!asset[0]) throw new Error('Asset niet gevonden')

  const [row] = await db
    .insert(assetValuations)
    .values({
      assetId,
      valuationDate: data.valuationDate,
      value:         data.value,
      currency:      data.currency ?? 'EUR',
    })
    .returning()

  return row
}

export async function getValuations(userId: string, assetId: string, limit = 10) {
  const tenantId = await getTenantId(userId)

  return db
    .select({
      id:            assetValuations.id,
      valuationDate: assetValuations.valuationDate,
      value:         assetValuations.value,
      currency:      assetValuations.currency,
      createdAt:     assetValuations.createdAt,
    })
    .from(assetValuations)
    .innerJoin(assets, eq(assets.id, assetValuations.assetId))
    .where(and(eq(assetValuations.assetId, assetId), eq(assets.tenantId, tenantId)))
    .orderBy(desc(assetValuations.valuationDate))
    .limit(limit)
}
