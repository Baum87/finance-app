import { and, eq, desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { mortgageBalances, mortgages, assets } from '@/lib/db/schema'
import { getOrCreateTenant } from './tenant'

export async function createMortgageBalance(
  userId: string,
  mortgageId: string,
  data: { balanceDate: string; outstandingBalance: string },
) {
  const tenantId = await getOrCreateTenant(userId)

  // Verify mortgage belongs to this tenant via asset → tenant chain
  const mortgage = await db
    .select({ id: mortgages.id })
    .from(mortgages)
    .innerJoin(assets, eq(assets.id, mortgages.assetId))
    .where(and(eq(mortgages.id, mortgageId), eq(assets.tenantId, tenantId)))
    .limit(1)
  if (!mortgage[0]) throw new Error('Hypotheek niet gevonden')

  const [row] = await db
    .insert(mortgageBalances)
    .values({
      mortgageId,
      balanceDate:        data.balanceDate,
      outstandingBalance: data.outstandingBalance,
    })
    .returning()

  return row
}

export async function getMortgageBalanceHistory(userId: string, mortgageId: string, limit = 10) {
  const tenantId = await getOrCreateTenant(userId)

  return db
    .select({
      id:                 mortgageBalances.id,
      balanceDate:        mortgageBalances.balanceDate,
      outstandingBalance: mortgageBalances.outstandingBalance,
    })
    .from(mortgageBalances)
    .innerJoin(mortgages, eq(mortgages.id, mortgageBalances.mortgageId))
    .innerJoin(assets, eq(assets.id, mortgages.assetId))
    .where(and(eq(mortgageBalances.mortgageId, mortgageId), eq(assets.tenantId, tenantId)))
    .orderBy(desc(mortgageBalances.balanceDate))
    .limit(limit)
}
