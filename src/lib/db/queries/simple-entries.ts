import { and, eq, desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  stockEtfEntries, cryptoEntries, pensionEntries, savingsEntries,
} from '@/lib/db/schema'
import { getOrCreateTenant } from './tenant'

// Eenvoudige invoerlijsten: geen "asset"-entiteit, alleen een append-only
// logboek per categorie. Elke insert is een losse rij; de meest recente rij
// per broker/bank/adres (op entryDate, dan createdAt als tiebreaker) is de
// huidige waarde van die positie — de categorie-totalen tellen deze per-groep
// laatste waarden bij elkaar op (zie latestPerGroup).

/** Geeft, uit een al op datum-aflopend gesorteerde lijst, alleen de eerste
 * (dus meest recente) rij per unieke groep terug — voorkomt dat oudere
 * invoer voor dezelfde broker/bank/adres dubbel meetelt in een optelsom. */
export function latestPerGroup<T>(rows: T[], keyFn: (row: T) => string): T[] {
  const seen = new Set<string>()
  const result: T[] = []
  for (const row of rows) {
    const key = keyFn(row)
    if (seen.has(key)) continue
    seen.add(key)
    result.push(row)
  }
  return result
}

/** Groepeert rijen op sleutel, met behoud van volgorde (dus ook binnen elke
 * groep — nuttig omdat de rijen al newest-first gesorteerd binnenkomen). */
export function groupBy<T>(rows: T[], keyFn: (row: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const row of rows) {
    const key = keyFn(row)
    const list = map.get(key)
    if (list) list.push(row)
    else map.set(key, [row])
  }
  return map
}

export async function createStockEtfEntry(
  userId: string,
  data: { broker: string; invested: string; currentValue: string; entryDate: string },
) {
  const tenantId = await getOrCreateTenant(userId)
  const [row] = await db.insert(stockEtfEntries).values({ tenantId, ...data }).returning()
  return row
}

export async function updateStockEtfEntry(
  userId: string,
  id: string,
  data: { broker: string; invested: string; currentValue: string; entryDate: string },
) {
  const tenantId = await getOrCreateTenant(userId)
  await db.update(stockEtfEntries).set(data)
    .where(and(eq(stockEtfEntries.id, id), eq(stockEtfEntries.tenantId, tenantId)))
}

export async function deleteStockEtfEntry(userId: string, id: string) {
  const tenantId = await getOrCreateTenant(userId)
  await db.delete(stockEtfEntries)
    .where(and(eq(stockEtfEntries.id, id), eq(stockEtfEntries.tenantId, tenantId)))
}

export async function getStockEtfEntries(userId: string) {
  const tenantId = await getOrCreateTenant(userId)
  return db.select().from(stockEtfEntries)
    .where(eq(stockEtfEntries.tenantId, tenantId))
    .orderBy(desc(stockEtfEntries.entryDate), desc(stockEtfEntries.createdAt))
}

export async function createCryptoEntry(
  userId: string,
  data: { broker: string; invested: string; currentValue: string; entryDate: string },
) {
  const tenantId = await getOrCreateTenant(userId)
  const [row] = await db.insert(cryptoEntries).values({ tenantId, ...data }).returning()
  return row
}

export async function updateCryptoEntry(
  userId: string,
  id: string,
  data: { broker: string; invested: string; currentValue: string; entryDate: string },
) {
  const tenantId = await getOrCreateTenant(userId)
  await db.update(cryptoEntries).set(data)
    .where(and(eq(cryptoEntries.id, id), eq(cryptoEntries.tenantId, tenantId)))
}

export async function deleteCryptoEntry(userId: string, id: string) {
  const tenantId = await getOrCreateTenant(userId)
  await db.delete(cryptoEntries)
    .where(and(eq(cryptoEntries.id, id), eq(cryptoEntries.tenantId, tenantId)))
}

export async function getCryptoEntries(userId: string) {
  const tenantId = await getOrCreateTenant(userId)
  return db.select().from(cryptoEntries)
    .where(eq(cryptoEntries.tenantId, tenantId))
    .orderBy(desc(cryptoEntries.entryDate), desc(cryptoEntries.createdAt))
}

export async function createPensionEntry(
  userId: string,
  data: { broker: string; invested: string; currentValue: string; entryDate: string },
) {
  const tenantId = await getOrCreateTenant(userId)
  const [row] = await db.insert(pensionEntries).values({ tenantId, ...data }).returning()
  return row
}

export async function updatePensionEntry(
  userId: string,
  id: string,
  data: { broker: string; invested: string; currentValue: string; entryDate: string },
) {
  const tenantId = await getOrCreateTenant(userId)
  await db.update(pensionEntries).set(data)
    .where(and(eq(pensionEntries.id, id), eq(pensionEntries.tenantId, tenantId)))
}

export async function deletePensionEntry(userId: string, id: string) {
  const tenantId = await getOrCreateTenant(userId)
  await db.delete(pensionEntries)
    .where(and(eq(pensionEntries.id, id), eq(pensionEntries.tenantId, tenantId)))
}

export async function getPensionEntries(userId: string) {
  const tenantId = await getOrCreateTenant(userId)
  return db.select().from(pensionEntries)
    .where(eq(pensionEntries.tenantId, tenantId))
    .orderBy(desc(pensionEntries.entryDate), desc(pensionEntries.createdAt))
}

export async function createSavingsEntry(
  userId: string,
  data: { bank: string; balance: string; entryDate: string },
) {
  const tenantId = await getOrCreateTenant(userId)
  const [row] = await db.insert(savingsEntries).values({ tenantId, ...data }).returning()
  return row
}

export async function updateSavingsEntry(
  userId: string,
  id: string,
  data: { bank: string; balance: string; entryDate: string },
) {
  const tenantId = await getOrCreateTenant(userId)
  await db.update(savingsEntries).set(data)
    .where(and(eq(savingsEntries.id, id), eq(savingsEntries.tenantId, tenantId)))
}

export async function deleteSavingsEntry(userId: string, id: string) {
  const tenantId = await getOrCreateTenant(userId)
  await db.delete(savingsEntries)
    .where(and(eq(savingsEntries.id, id), eq(savingsEntries.tenantId, tenantId)))
}

export async function getSavingsEntries(userId: string) {
  const tenantId = await getOrCreateTenant(userId)
  return db.select().from(savingsEntries)
    .where(eq(savingsEntries.tenantId, tenantId))
    .orderBy(desc(savingsEntries.entryDate), desc(savingsEntries.createdAt))
}

