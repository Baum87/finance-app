import Decimal from 'decimal.js'
import { and, eq, asc, desc, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  dossierPersons, dossierDocuments, dossierContacts, insurancePolicies,
  businesses, dossierNotes, mortgages, mortgageBalances, assets,
} from '@/lib/db/schema'
import { getOrCreateTenant, getReadableTenant } from './tenant'

// Dossier (stamdocument geldzaken) — zie schema.ts. Vijf lijst-tabellen met
// identieke CRUD (tenantId + id), plus dossier_notes als vrije tekst per onderwerp.

const DOSSIER_TABLES = {
  person:   dossierPersons,
  document: dossierDocuments,
  contact:  dossierContacts,
  policy:   insurancePolicies,
  business: businesses,
} as const

export type DossierKind = keyof typeof DOSSIER_TABLES

type InsertOf<K extends DossierKind> = (typeof DOSSIER_TABLES)[K]['$inferInsert']
export type DossierInput<K extends DossierKind> =
  Omit<InsertOf<K>, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>

export type DossierNoteTopic =
  | 'family_situation' | 'work_situation' | 'expected_changes'
  | 'wishes' | 'open_items' | 'digital_legacy' | 'other_matters'

export async function getDossier(userId: string) {
  const tenantId = await getReadableTenant(userId)
  const [persons, documents, contacts, policies, businessRows, notes] = await Promise.all([
    db.select().from(dossierPersons).where(eq(dossierPersons.tenantId, tenantId))
      .orderBy(asc(dossierPersons.birthDate), asc(dossierPersons.createdAt)),
    db.select().from(dossierDocuments).where(eq(dossierDocuments.tenantId, tenantId))
      .orderBy(desc(dossierDocuments.documentDate), asc(dossierDocuments.createdAt)),
    db.select().from(dossierContacts).where(eq(dossierContacts.tenantId, tenantId))
      .orderBy(asc(dossierContacts.createdAt)),
    db.select().from(insurancePolicies).where(eq(insurancePolicies.tenantId, tenantId))
      .orderBy(asc(insurancePolicies.createdAt)),
    db.select().from(businesses).where(eq(businesses.tenantId, tenantId))
      .orderBy(asc(businesses.createdAt)),
    db.select().from(dossierNotes).where(eq(dossierNotes.tenantId, tenantId)),
  ])

  const notesByTopic = new Map(notes.map(n => [n.topic as DossierNoteTopic, n.body]))

  // Voor nabestaanden relevant: hoe actueel is dit overzicht?
  const lastUpdated = [persons, documents, contacts, policies, businessRows, notes]
    .flat()
    .reduce<Date | null>((latest, r) => (!latest || r.updatedAt > latest ? r.updatedAt : latest), null)

  return { persons, documents, contacts, policies, businesses: businessRows, notesByTopic, lastUpdated }
}

export type Dossier = Awaited<ReturnType<typeof getDossier>>

/** Insert (zonder id) of update (met id) van een dossier-item, altijd binnen de tenant. */
export async function saveDossierItem<K extends DossierKind>(
  userId: string,
  kind: K,
  id: string | null,
  data: DossierInput<K>,
) {
  const tenantId = await getOrCreateTenant(userId)
  // Drizzle kan een union van tabellen niet aan één generieke insert/update
  // koppelen; de Zod-schema's in de action garanderen dat `data` bij `kind` past.
  const table = DOSSIER_TABLES[kind] as typeof dossierPersons
  const values = data as DossierInput<'person'>

  if (id) {
    const [row] = await db
      .update(table)
      .set({ ...values, updatedAt: new Date() })
      .where(and(eq(table.id, id), eq(table.tenantId, tenantId)))
      .returning({ id: table.id })
    if (!row) throw new Error('Dossier-item niet gevonden')
  } else {
    await db.insert(table).values({ ...values, tenantId })
  }
}

export async function deleteDossierItem(userId: string, kind: DossierKind, id: string) {
  const tenantId = await getOrCreateTenant(userId)
  const table = DOSSIER_TABLES[kind]
  await db.delete(table).where(and(eq(table.id, id), eq(table.tenantId, tenantId)))
}

/** Lege tekst verwijdert de notitie; anders upsert op (tenant, topic). */
export async function saveDossierNote(userId: string, topic: DossierNoteTopic, body: string) {
  const tenantId = await getOrCreateTenant(userId)
  if (body === '') {
    await db.delete(dossierNotes)
      .where(and(eq(dossierNotes.tenantId, tenantId), eq(dossierNotes.topic, topic)))
    return
  }
  await db
    .insert(dossierNotes)
    .values({ tenantId, topic, body })
    .onConflictDoUpdate({
      target: [dossierNotes.tenantId, dossierNotes.topic],
      set: { body, updatedAt: new Date() },
    })
}

/**
 * Actieve hypotheken met geldverstrekker en actuele restschuld (laatste
 * mortgage_balances-rij, anders hoofdsom — zelfde fallback als
 * getMortgageBalancesMap). Per hypotheek i.p.v. per asset, omdat
 * nabestaanden per lening de verstrekker moeten benaderen.
 */
export async function getMortgagesOverview(userId: string) {
  const tenantId = await getReadableTenant(userId)

  const rows = await db
    .select({
      id:                     mortgages.id,
      assetName:              assets.name,
      lender:                 mortgages.lender,
      originalAmount:         mortgages.originalAmount,
      interestRate:           mortgages.interestRate,
      interestRateFixedUntil: mortgages.interestRateFixedUntil,
      mortgageType:           mortgages.mortgageType,
      endDate:                mortgages.endDate,
    })
    .from(mortgages)
    .innerJoin(assets, eq(assets.id, mortgages.assetId))
    .where(and(eq(assets.tenantId, tenantId), eq(assets.isActive, true), eq(mortgages.isActive, true)))
    .orderBy(asc(mortgages.startDate))

  if (rows.length === 0) return []

  const balances = await db
    .select({ mortgageId: mortgageBalances.mortgageId, outstandingBalance: mortgageBalances.outstandingBalance })
    .from(mortgageBalances)
    .where(inArray(mortgageBalances.mortgageId, rows.map(r => r.id)))
    .orderBy(desc(mortgageBalances.balanceDate))

  const latest = new Map<string, string>()
  for (const b of balances) {
    if (!latest.has(b.mortgageId)) latest.set(b.mortgageId, b.outstandingBalance)
  }

  return rows.map(r => ({
    ...r,
    outstandingBalance: new Decimal(latest.get(r.id) ?? r.originalAmount),
  }))
}

export type MortgageOverviewRow = Awaited<ReturnType<typeof getMortgagesOverview>>[number]
