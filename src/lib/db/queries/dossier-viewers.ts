import { and, eq, gt, inArray, asc, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { dossierViewers, tenantUsers, tenants, users } from '@/lib/db/schema'
import { getOrCreateTenant } from './tenant'

// Leesaccounts voor nabestaanden — zie dossierViewers in schema.ts. Alle
// functies resolven de tenant via getOrCreateTenant, dus alleen een owner kan
// ze aanroepen (een viewer krijgt daar een Error).

export async function getDossierViewers(userId: string) {
  const tenantId = await getOrCreateTenant(userId)
  return db
    .select({ userId: dossierViewers.userId, email: dossierViewers.email, createdAt: dossierViewers.createdAt })
    .from(dossierViewers)
    .where(eq(dossierViewers.tenantId, tenantId))
    .orderBy(asc(dossierViewers.createdAt))
}

export type DossierViewer = Awaited<ReturnType<typeof getDossierViewers>>[number]

/** Gooit als de viewer niet bij het dossier van deze owner hoort. */
export async function getDossierViewer(userId: string, viewerUserId: string): Promise<DossierViewer> {
  const tenantId = await getOrCreateTenant(userId)
  const [row] = await db
    .select({ userId: dossierViewers.userId, email: dossierViewers.email, createdAt: dossierViewers.createdAt })
    .from(dossierViewers)
    .where(and(eq(dossierViewers.userId, viewerUserId), eq(dossierViewers.tenantId, tenantId)))
  if (!row) throw new Error('Leesaccount niet gevonden')
  return row
}

/**
 * Koppelt een zojuist via de admin-API aangemaakte auth-user als viewer aan
 * het dossier van de owner. Alleen aanroepen direct na createUser.
 */
export async function linkDossierViewer(userId: string, viewerUserId: string, email: string) {
  const tenantId = await getOrCreateTenant(userId)

  await db.transaction(async tx => {
    // FK-vereiste; trigger.sql maakt deze rij normaal al aan.
    await tx.insert(users).values({ id: viewerUserId, email }).onConflictDoNothing()

    // trigger.sql geeft elke nieuwe auth-user een eigen (lege) tenant als owner.
    // Een viewer hoort er geen te hebben — anders zou getOrCreateTenant die
    // teruggeven en de schrijfblokkade omzeilen. Extra vangnet: alleen tenants
    // van de afgelopen 10 minuten, zodat nooit een bestaande tenant verdwijnt.
    const ownTenants = await tx
      .select({ tenantId: tenantUsers.tenantId })
      .from(tenantUsers)
      .innerJoin(tenants, eq(tenants.id, tenantUsers.tenantId))
      .where(and(
        eq(tenantUsers.userId, viewerUserId),
        eq(tenantUsers.role, 'owner'),
        gt(tenants.createdAt, sql`now() - interval '10 minutes'`),
      ))
    if (ownTenants.length > 0) {
      await tx.delete(tenants).where(inArray(tenants.id, ownTenants.map(t => t.tenantId)))
    }

    await tx.insert(dossierViewers).values({ tenantId, userId: viewerUserId, email })
  })
}

export async function removeDossierViewer(userId: string, viewerUserId: string) {
  const tenantId = await getOrCreateTenant(userId)
  const deleted = await db
    .delete(dossierViewers)
    .where(and(eq(dossierViewers.userId, viewerUserId), eq(dossierViewers.tenantId, tenantId)))
    .returning({ userId: dossierViewers.userId })
  if (deleted.length === 0) throw new Error('Leesaccount niet gevonden')
}
