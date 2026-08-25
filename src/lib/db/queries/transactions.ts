import { and, eq, desc, asc, inArray, gte } from 'drizzle-orm'
import { db } from '@/lib/db'
import { transactions, assets } from '@/lib/db/schema'
import type { TransactionType, DetailedTransaction } from '@/types'
import { getOrCreateTenant } from './tenant'

async function verifyAssetAccess(userId: string, assetId: string): Promise<void> {
  const tenantId = await getOrCreateTenant(userId)
  const rows = await db
    .select({ id: assets.id })
    .from(assets)
    .where(and(eq(assets.id, assetId), eq(assets.tenantId, tenantId)))
    .limit(1)

  if (!rows[0]) throw new Error('Asset niet gevonden of geen toegang')
}

async function verifyTransactionAccess(userId: string, transactionId: string): Promise<void> {
  const tenantId = await getOrCreateTenant(userId)
  const rows = await db
    .select({ id: transactions.id })
    .from(transactions)
    .innerJoin(assets, eq(assets.id, transactions.assetId))
    .where(and(eq(transactions.id, transactionId), eq(assets.tenantId, tenantId)))
    .limit(1)

  if (!rows[0]) throw new Error('Transactie niet gevonden of geen toegang')
}

export async function getTransactions(userId: string, assetId: string) {
  await verifyAssetAccess(userId, assetId)
  return db
    .select()
    .from(transactions)
    .where(eq(transactions.assetId, assetId))
    .orderBy(desc(transactions.transactionDate))
}

export type Transaction = Awaited<ReturnType<typeof getTransactions>>[number]

export type CreateTransactionInput = {
  transactionType: TransactionType
  amount: string
  quantity?: string | null
  pricePerUnit?: string | null
  transactionDate: string
  currency?: string
  fxRate?: string
  notes?: string | null
  fees?: string | null
}

export async function createTransaction(
  userId: string,
  assetId: string,
  data: CreateTransactionInput,
) {
  await verifyAssetAccess(userId, assetId)
  const [tx] = await db
    .insert(transactions)
    .values({
      assetId,
      transactionType: data.transactionType,
      amount: data.amount,
      quantity: data.quantity ?? null,
      pricePerUnit: data.pricePerUnit ?? null,
      transactionDate: data.transactionDate,
      currency: data.currency ?? 'EUR',
      fxRate: data.fxRate ?? '1',
      notes: data.notes ?? null,
      fees: data.fees ?? '0',
    })
    .returning()
  return tx
}

export async function updateTransaction(
  userId: string,
  transactionId: string,
  data: CreateTransactionInput,
) {
  await verifyTransactionAccess(userId, transactionId)
  const [tx] = await db
    .update(transactions)
    .set({
      transactionType: data.transactionType,
      amount: data.amount,
      quantity: data.quantity ?? null,
      pricePerUnit: data.pricePerUnit ?? null,
      transactionDate: data.transactionDate,
      currency: data.currency ?? 'EUR',
      fxRate: data.fxRate ?? '1',
      notes: data.notes ?? null,
      fees: data.fees ?? '0',
    })
    .where(eq(transactions.id, transactionId))
    .returning()
  return tx
}

export async function getTransactionById(userId: string, transactionId: string) {
  await verifyTransactionAccess(userId, transactionId)
  const [tx] = await db
    .select()
    .from(transactions)
    .where(eq(transactions.id, transactionId))
    .limit(1)
  return tx ?? null
}

export async function deleteTransaction(userId: string, transactionId: string) {
  await verifyTransactionAccess(userId, transactionId)
  await db.delete(transactions).where(eq(transactions.id, transactionId))
}

export type RawTransaction = {
  transactionType: string
  amount: string
  transactionDate: string
  currency: string
}

/**
 * All transactions for a set of asset IDs, optionally filtered from a date.
 * Used for portfolio XIRR/TWR calculations in page components.
 */
export async function getTransactionsByAssetsDetailed(
  userId: string,
  assetIds: string[],
): Promise<DetailedTransaction[]> {
  if (assetIds.length === 0) return []
  const tenantId = await getOrCreateTenant(userId)
  return db
    .select({
      assetId:         transactions.assetId,
      transactionType: transactions.transactionType,
      amount:          transactions.amount,
      quantity:        transactions.quantity,
      transactionDate: transactions.transactionDate,
      fees:            transactions.fees,
    })
    .from(transactions)
    .innerJoin(assets, eq(assets.id, transactions.assetId))
    .where(and(inArray(transactions.assetId, assetIds), eq(assets.tenantId, tenantId)))
    .orderBy(asc(transactions.transactionDate))
}

// ─── Bulk import (xlsx) ────────────────────────────────────────────────────────

export type ImportTransactionInput = {
  assetId: string
  transactionType: TransactionType
  amount: string
  quantity: string
  pricePerUnit: string
  fees: string
  transactionDate: string
  externalRef: string | null
}

/**
 * Bulk-insert voor xlsx-import. Dedup via ON CONFLICT (asset_id, external_ref)
 * DO NOTHING — een herupload van (een deel van) hetzelfde bestand voegt nooit
 * dubbele transacties toe. Rijen zonder externalRef conflicteren nooit
 * (Postgres beschouwt NULL nooit als gelijk aan NULL).
 */
export async function importTransactions(
  userId: string,
  rows: ImportTransactionInput[],
): Promise<{ inserted: number; duplicates: number }> {
  if (rows.length === 0) return { inserted: 0, duplicates: 0 }

  const distinctAssetIds = [...new Set(rows.map(r => r.assetId))]
  for (const assetId of distinctAssetIds) await verifyAssetAccess(userId, assetId)

  const inserted = await db
    .insert(transactions)
    .values(rows.map(r => ({
      assetId:         r.assetId,
      transactionType: r.transactionType,
      amount:          r.amount,
      quantity:        r.quantity,
      pricePerUnit:    r.pricePerUnit,
      fees:            r.fees,
      currency:        'EUR',
      fxRate:          '1',
      transactionDate: r.transactionDate,
      externalRef:     r.externalRef,
    })))
    .onConflictDoNothing({ target: [transactions.assetId, transactions.externalRef] })
    .returning({ id: transactions.id })

  return { inserted: inserted.length, duplicates: rows.length - inserted.length }
}

export async function getTransactionsByAssets(
  userId: string,
  assetIds: string[],
  fromDate?: string,
): Promise<RawTransaction[]> {
  if (assetIds.length === 0) return []
  const tenantId = await getOrCreateTenant(userId)
  const conditions = fromDate
    ? and(inArray(transactions.assetId, assetIds), gte(transactions.transactionDate, fromDate), eq(assets.tenantId, tenantId))
    : and(inArray(transactions.assetId, assetIds), eq(assets.tenantId, tenantId))

  return db
    .select({
      transactionType: transactions.transactionType,
      amount:          transactions.amount,
      transactionDate: transactions.transactionDate,
      currency:        transactions.currency,
    })
    .from(transactions)
    .innerJoin(assets, eq(assets.id, transactions.assetId))
    .where(conditions)
    .orderBy(asc(transactions.transactionDate))
}
