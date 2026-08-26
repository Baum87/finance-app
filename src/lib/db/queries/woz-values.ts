import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { wozValues, assets } from '@/lib/db/schema'
import { getOrCreateTenant } from './tenant'

export async function createWozValue(
  userId: string,
  assetId: string,
  data: { wozDate: string; value: string },
) {
  const tenantId = await getOrCreateTenant(userId)

  const asset = await db
    .select({ id: assets.id })
    .from(assets)
    .where(and(eq(assets.id, assetId), eq(assets.tenantId, tenantId)))
    .limit(1)
  if (!asset[0]) throw new Error('Asset niet gevonden')

  const [row] = await db
    .insert(wozValues)
    .values({ assetId, wozDate: data.wozDate, value: data.value })
    .returning()

  return row
}

export async function updateWozValue(
  userId: string,
  wozValueId: string,
  data: { wozDate: string; value: string },
) {
  const tenantId = await getOrCreateTenant(userId)

  const row = await db
    .select({ id: wozValues.id })
    .from(wozValues)
    .innerJoin(assets, eq(assets.id, wozValues.assetId))
    .where(and(eq(wozValues.id, wozValueId), eq(assets.tenantId, tenantId)))
    .limit(1)
  if (!row[0]) throw new Error('WOZ-waarde niet gevonden')

  await db
    .update(wozValues)
    .set({ wozDate: data.wozDate, value: data.value })
    .where(eq(wozValues.id, wozValueId))
}

export async function deleteWozValue(userId: string, wozValueId: string) {
  const tenantId = await getOrCreateTenant(userId)

  const row = await db
    .select({ id: wozValues.id })
    .from(wozValues)
    .innerJoin(assets, eq(assets.id, wozValues.assetId))
    .where(and(eq(wozValues.id, wozValueId), eq(assets.tenantId, tenantId)))
    .limit(1)
  if (!row[0]) throw new Error('WOZ-waarde niet gevonden')

  await db.delete(wozValues).where(eq(wozValues.id, wozValueId))
}
