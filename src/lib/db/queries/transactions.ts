import { and, eq, desc, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { transactions, assets, tenantUsers } from '@/lib/db/schema'
import type { TransactionType } from '@/types'

async function verifyAssetAccess(userId: string, assetId: string): Promise<void> {
  const rows = await db
    .select({ id: assets.id })
    .from(assets)
    .innerJoin(tenantUsers, eq(tenantUsers.tenantId, assets.tenantId))
    .where(and(eq(assets.id, assetId), eq(tenantUsers.userId, userId)))
    .limit(1)

  if (!rows[0]) throw new Error('Asset niet gevonden of geen toegang')
}

async function verifyTransactionAccess(userId: string, transactionId: string): Promise<void> {
  const rows = await db
    .select({ id: transactions.id })
    .from(transactions)
    .innerJoin(assets, eq(assets.id, transactions.assetId))
    .innerJoin(tenantUsers, eq(tenantUsers.tenantId, assets.tenantId))
    .where(and(eq(transactions.id, transactionId), eq(tenantUsers.userId, userId)))
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
    })
    .where(eq(transactions.id, transactionId))
    .returning()
  return tx
}

export async function deleteTransaction(userId: string, transactionId: string) {
  await verifyTransactionAccess(userId, transactionId)
  await db.delete(transactions).where(eq(transactions.id, transactionId))
}
