import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { assetValuations, assets } from '@/lib/db/schema'
import { getOrCreateTenant } from './tenant'

export async function createValuation(
  userId: string,
  assetId: string,
  data: { valuationDate: string; value: string; currency?: string },
) {
  const tenantId = await getOrCreateTenant(userId)

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

export async function updateValuation(
  userId: string,
  valuationId: string,
  data: { valuationDate: string; value: string; currency?: string },
) {
  const tenantId = await getOrCreateTenant(userId)

  const row = await db
    .select({ id: assetValuations.id })
    .from(assetValuations)
    .innerJoin(assets, eq(assets.id, assetValuations.assetId))
    .where(and(eq(assetValuations.id, valuationId), eq(assets.tenantId, tenantId)))
    .limit(1)
  if (!row[0]) throw new Error('Waardering niet gevonden')

  await db
    .update(assetValuations)
    .set({
      valuationDate: data.valuationDate,
      value:         data.value,
      currency:      data.currency ?? 'EUR',
    })
    .where(eq(assetValuations.id, valuationId))
}

export async function deleteValuation(userId: string, valuationId: string) {
  const tenantId = await getOrCreateTenant(userId)

  const row = await db
    .select({ id: assetValuations.id })
    .from(assetValuations)
    .innerJoin(assets, eq(assets.id, assetValuations.assetId))
    .where(and(eq(assetValuations.id, valuationId), eq(assets.tenantId, tenantId)))
    .limit(1)

  if (!row[0]) throw new Error('Waardering niet gevonden')

  await db.delete(assetValuations).where(eq(assetValuations.id, valuationId))
}
