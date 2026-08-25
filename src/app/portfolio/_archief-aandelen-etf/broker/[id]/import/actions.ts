'use server'

import { redirect } from 'next/navigation'
import { isRedirectError } from 'next/dist/client/components/redirect-error'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/db/supabase-server'
import { getBrokers } from '@/lib/db/queries/brokers'
import { createAsset, findStockEtfAssetsByIsins } from '@/lib/db/queries/assets'
import { importTransactions, type ImportTransactionInput } from '@/lib/db/queries/transactions'
import { parseTransactionFile } from '@/lib/services/import/parse'
import { suggestTicker } from '@/lib/services/prices'
import type { ParsedTransactionRow, ParseWarning } from '@/lib/services/import/types'

async function requireUser() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return user
}

async function requireBroker(userId: string, brokerId: string) {
  const brokers = await getBrokers(userId)
  const broker = brokers.find(b => b.id === brokerId)
  if (!broker) throw new Error('Broker niet gevonden')
  return broker
}

// ─── Preview (upload) ──────────────────────────────────────────────────────────

export type PreviewGroupExisting = {
  isin: string
  assetId: string
  assetName: string
  ticker: string
  rows: ParsedTransactionRow[]
}

export type PreviewGroupNew = {
  isin: string
  product: string
  suggestedTicker: string | null
  suggestedSector: string | null
  rows: ParsedTransactionRow[]
}

export type ImportPreviewState =
  | { error: string }
  | null
  | {
      brokerId: string
      existing: PreviewGroupExisting[]
      newPositions: PreviewGroupNew[]
      warnings: ParseWarning[]
    }

export async function parseImportAction(
  prev: ImportPreviewState,
  fd: FormData,
): Promise<ImportPreviewState> {
  try {
    const user = await requireUser()
    const brokerId = String(fd.get('brokerId') ?? '')
    await requireBroker(user.id, brokerId)

    const file = fd.get('file') as File | null
    if (!file || file.size === 0) return { error: 'Kies een bestand om te importeren' }

    const buffer = Buffer.from(await file.arrayBuffer())
    const parsed = await parseTransactionFile(buffer)

    const isins = [...new Set(parsed.rows.map(r => r.isin))]
    const matches = await findStockEtfAssetsByIsins(user.id, isins)
    const matchByIsin = new Map(matches.map(m => [m.isin, m]))

    const existingMap = new Map<string, PreviewGroupExisting>()
    const newMap = new Map<string, { product: string; rows: ParsedTransactionRow[] }>()

    for (const row of parsed.rows) {
      const match = matchByIsin.get(row.isin)
      if (match) {
        const group = existingMap.get(row.isin)
        if (group) group.rows.push(row)
        else existingMap.set(row.isin, { isin: row.isin, assetId: match.assetId, assetName: match.name, ticker: match.ticker, rows: [row] })
      } else {
        const group = newMap.get(row.isin)
        if (group) group.rows.push(row)
        else newMap.set(row.isin, { product: row.product, rows: [row] })
      }
    }

    const newPositions: PreviewGroupNew[] = await Promise.all(
      [...newMap.entries()].map(async ([isin, { product, rows }]) => {
        const suggestion = await suggestTicker(isin, product)
        return {
          isin,
          product,
          suggestedTicker: suggestion?.symbol ?? null,
          suggestedSector: suggestion?.sector ?? null,
          rows,
        }
      }),
    )

    return {
      brokerId,
      existing: [...existingMap.values()],
      newPositions,
      warnings: parsed.warnings,
    }
  } catch (e) {
    if (isRedirectError(e)) throw e
    return { error: e instanceof Error ? e.message : 'Onbekende fout bij het lezen van het bestand' }
  }
}

// ─── Confirm (create + import) ─────────────────────────────────────────────────

export type ConfirmNewPosition = {
  isin: string
  product: string
  /** Leeg = deze positie overslaan (rijen worden niet geïmporteerd). */
  ticker: string
  sector: string | null
}

export type ConfirmImportInput = {
  brokerId: string
  existing: { assetId: string; rows: ParsedTransactionRow[] }[]
  newPositions: (ConfirmNewPosition & { rows: ParsedTransactionRow[] })[]
}

export type ConfirmImportResult =
  | { error: string }
  | { createdPositions: number; skippedPositions: number; inserted: number; duplicates: number }

// confirmImportAction neemt een JS-object aan (geen FormData) en is als Server
// Action rechtstreeks aanroepbaar buiten deze form-flow om — daarom hier alsnog
// runtime-validatie, ook al garandeert het TS-type dit al op compile-time.
const positiveDecimalString = (label: string) =>
  z.string().refine(v => !Number.isNaN(Number(v)) && Number(v) > 0, `${label} moet een getal groter dan 0 zijn`)

const parsedTransactionRowSchema = z.object({
  isin:            z.string().min(1),
  product:         z.string().min(1),
  transactionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ongeldige transactiedatum'),
  transactionType: z.enum(['buy', 'sell']),
  quantity:        positiveDecimalString('Aantal'),
  pricePerUnit:    positiveDecimalString('Prijs per stuk'),
  amount:          positiveDecimalString('Bedrag'),
  fees:            z.string().refine(v => !Number.isNaN(Number(v)) && Number(v) >= 0, 'Kosten moeten 0 of hoger zijn'),
  externalRef:     z.string().nullable(),
})

const confirmImportSchema = z.object({
  brokerId: z.string().uuid('Ongeldig broker-ID'),
  existing: z.array(z.object({
    assetId: z.string().uuid('Ongeldig asset-ID'),
    rows:    z.array(parsedTransactionRowSchema),
  })),
  newPositions: z.array(z.object({
    isin:    z.string().min(1),
    product: z.string().min(1),
    ticker:  z.string(),
    sector:  z.string().nullable(),
    rows:    z.array(parsedTransactionRowSchema),
  })),
})

function toImportInput(assetId: string, row: ParsedTransactionRow): ImportTransactionInput {
  return {
    assetId,
    transactionType: row.transactionType,
    amount: row.amount,
    quantity: row.quantity,
    pricePerUnit: row.pricePerUnit,
    fees: row.fees,
    transactionDate: row.transactionDate,
    externalRef: row.externalRef,
  }
}

export async function confirmImportAction(rawInput: ConfirmImportInput): Promise<ConfirmImportResult> {
  try {
    const input = confirmImportSchema.parse(rawInput)
    const user = await requireUser()
    await requireBroker(user.id, input.brokerId)

    const rows: ImportTransactionInput[] = []
    for (const group of input.existing) {
      for (const row of group.rows) rows.push(toImportInput(group.assetId, row))
    }

    let createdPositions = 0
    let skippedPositions = 0
    for (const group of input.newPositions) {
      const ticker = group.ticker.trim()
      if (!ticker) { skippedPositions++; continue }
      const asset = await createAsset(user.id, {
        name: group.product,
        assetType: 'stock_etf',
        currency: 'EUR',
        details: {
          kind: 'stock_etf',
          ticker,
          isin: group.isin,
          brokerId: input.brokerId,
          sector: group.sector ?? undefined,
        },
      })
      createdPositions++
      for (const row of group.rows) rows.push(toImportInput(asset.id, row))
    }

    const { inserted, duplicates } = await importTransactions(user.id, rows)

    revalidatePath(`/portfolio/aandelen-etf/broker/${input.brokerId}`)
    revalidatePath('/portfolio/aandelen-etf')

    return { createdPositions, skippedPositions, inserted, duplicates }
  } catch (e) {
    if (isRedirectError(e)) throw e
    if (e instanceof z.ZodError) return { error: e.issues[0].message }
    return { error: e instanceof Error ? e.message : 'Onbekende fout bij importeren' }
  }
}
