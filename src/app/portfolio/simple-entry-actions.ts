'use server'

import { redirect } from 'next/navigation'
import { isRedirectError } from 'next/dist/client/components/redirect-error'
import { z } from 'zod'
import { requireUser } from '@/lib/db/supabase-server'
import {
  createStockEtfEntry, updateStockEtfEntry, deleteStockEtfEntry,
  createCryptoEntry, updateCryptoEntry, deleteCryptoEntry,
  createPensionEntry, updatePensionEntry, deletePensionEntry,
  createSavingsEntry, updateSavingsEntry, deleteSavingsEntry,
  createRealEstateEntry, updateRealEstateEntry, deleteRealEstateEntry,
} from '@/lib/db/queries/simple-entries'

export type ActionState = { error: string } | null

function str(fd: FormData, key: string): string {
  return (fd.get(key) as string | null) ?? ''
}

const investedEntrySchema = z.object({
  broker:       z.string().min(1, 'Broker is verplicht'),
  invested:     z.string().min(1, 'Ingelegd bedrag is verplicht'),
  currentValue: z.string().min(1, 'Huidige waarde is verplicht'),
  entryDate:    z.string().min(1, 'Datum is verplicht'),
})

// ─── Aandelen / ETF ────────────────────────────────────────────────────────

export async function createStockEtfEntryAction(prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireUser()
    const d = investedEntrySchema.parse({
      broker: str(fd, 'broker'), invested: str(fd, 'invested'),
      currentValue: str(fd, 'currentValue'), entryDate: str(fd, 'entryDate'),
    })
    await createStockEtfEntry(user.id, d)
    redirect('/portfolio/aandelen-etf')
  } catch (e) {
    if (isRedirectError(e)) throw e
    if (e instanceof z.ZodError) return { error: e.issues[0].message }
    return { error: e instanceof Error ? e.message : 'Onbekende fout' }
  }
}

export async function updateStockEtfEntryAction(fd: FormData): Promise<void> {
  const user = await requireUser()
  const d = investedEntrySchema.parse({
    broker: str(fd, 'broker'), invested: str(fd, 'invested'),
    currentValue: str(fd, 'currentValue'), entryDate: str(fd, 'entryDate'),
  })
  await updateStockEtfEntry(user.id, str(fd, 'id'), d)
  redirect('/portfolio/aandelen-etf')
}

export async function deleteStockEtfEntryAction(fd: FormData): Promise<void> {
  const user = await requireUser()
  await deleteStockEtfEntry(user.id, str(fd, 'id'))
  redirect('/portfolio/aandelen-etf')
}

// ─── Crypto ────────────────────────────────────────────────────────────────

export async function createCryptoEntryAction(prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireUser()
    const d = investedEntrySchema.parse({
      broker: str(fd, 'broker'), invested: str(fd, 'invested'),
      currentValue: str(fd, 'currentValue'), entryDate: str(fd, 'entryDate'),
    })
    await createCryptoEntry(user.id, d)
    redirect('/portfolio/crypto')
  } catch (e) {
    if (isRedirectError(e)) throw e
    if (e instanceof z.ZodError) return { error: e.issues[0].message }
    return { error: e instanceof Error ? e.message : 'Onbekende fout' }
  }
}

export async function updateCryptoEntryAction(fd: FormData): Promise<void> {
  const user = await requireUser()
  const d = investedEntrySchema.parse({
    broker: str(fd, 'broker'), invested: str(fd, 'invested'),
    currentValue: str(fd, 'currentValue'), entryDate: str(fd, 'entryDate'),
  })
  await updateCryptoEntry(user.id, str(fd, 'id'), d)
  redirect('/portfolio/crypto')
}

export async function deleteCryptoEntryAction(fd: FormData): Promise<void> {
  const user = await requireUser()
  await deleteCryptoEntry(user.id, str(fd, 'id'))
  redirect('/portfolio/crypto')
}

// ─── Pensioen ──────────────────────────────────────────────────────────────

export async function createPensionEntryAction(prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireUser()
    const d = investedEntrySchema.parse({
      broker: str(fd, 'broker'), invested: str(fd, 'invested'),
      currentValue: str(fd, 'currentValue'), entryDate: str(fd, 'entryDate'),
    })
    await createPensionEntry(user.id, d)
    redirect('/portfolio/pensioen')
  } catch (e) {
    if (isRedirectError(e)) throw e
    if (e instanceof z.ZodError) return { error: e.issues[0].message }
    return { error: e instanceof Error ? e.message : 'Onbekende fout' }
  }
}

export async function updatePensionEntryAction(fd: FormData): Promise<void> {
  const user = await requireUser()
  const d = investedEntrySchema.parse({
    broker: str(fd, 'broker'), invested: str(fd, 'invested'),
    currentValue: str(fd, 'currentValue'), entryDate: str(fd, 'entryDate'),
  })
  await updatePensionEntry(user.id, str(fd, 'id'), d)
  redirect('/portfolio/pensioen')
}

export async function deletePensionEntryAction(fd: FormData): Promise<void> {
  const user = await requireUser()
  await deletePensionEntry(user.id, str(fd, 'id'))
  redirect('/portfolio/pensioen')
}

// ─── Spaarrekening ─────────────────────────────────────────────────────────

const savingsEntrySchema = z.object({
  bank:      z.string().min(1, 'Bank is verplicht'),
  balance:   z.string().min(1, 'Vermogen is verplicht'),
  entryDate: z.string().min(1, 'Datum is verplicht'),
})

export async function createSavingsEntryAction(prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireUser()
    const d = savingsEntrySchema.parse({
      bank: str(fd, 'bank'), balance: str(fd, 'balance'), entryDate: str(fd, 'entryDate'),
    })
    await createSavingsEntry(user.id, d)
    redirect('/portfolio/spaarrekeningen')
  } catch (e) {
    if (isRedirectError(e)) throw e
    if (e instanceof z.ZodError) return { error: e.issues[0].message }
    return { error: e instanceof Error ? e.message : 'Onbekende fout' }
  }
}

export async function updateSavingsEntryAction(fd: FormData): Promise<void> {
  const user = await requireUser()
  const d = savingsEntrySchema.parse({
    bank: str(fd, 'bank'), balance: str(fd, 'balance'), entryDate: str(fd, 'entryDate'),
  })
  await updateSavingsEntry(user.id, str(fd, 'id'), d)
  redirect('/portfolio/spaarrekeningen')
}

export async function deleteSavingsEntryAction(fd: FormData): Promise<void> {
  const user = await requireUser()
  await deleteSavingsEntry(user.id, str(fd, 'id'))
  redirect('/portfolio/spaarrekeningen')
}

// ─── Vastgoed ──────────────────────────────────────────────────────────────

const realEstateEntrySchema = z.object({
  street:     z.string().min(1, 'Straat is verplicht'),
  postalCode: z.string().min(1, 'Postcode is verplicht'),
  city:       z.string().min(1, 'Plaats is verplicht'),
  wozValue:   z.string().min(1, 'WOZ-waarde is verplicht'),
  entryDate:  z.string().min(1, 'Datum is verplicht'),
})

export async function createRealEstateEntryAction(prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireUser()
    const d = realEstateEntrySchema.parse({
      street: str(fd, 'street'), postalCode: str(fd, 'postalCode'),
      city: str(fd, 'city'), wozValue: str(fd, 'wozValue'), entryDate: str(fd, 'entryDate'),
    })
    await createRealEstateEntry(user.id, d)
    redirect('/portfolio/vastgoed')
  } catch (e) {
    if (isRedirectError(e)) throw e
    if (e instanceof z.ZodError) return { error: e.issues[0].message }
    return { error: e instanceof Error ? e.message : 'Onbekende fout' }
  }
}

export async function updateRealEstateEntryAction(fd: FormData): Promise<void> {
  const user = await requireUser()
  const d = realEstateEntrySchema.parse({
    street: str(fd, 'street'), postalCode: str(fd, 'postalCode'),
    city: str(fd, 'city'), wozValue: str(fd, 'wozValue'), entryDate: str(fd, 'entryDate'),
  })
  await updateRealEstateEntry(user.id, str(fd, 'id'), d)
  redirect('/portfolio/vastgoed')
}

export async function deleteRealEstateEntryAction(fd: FormData): Promise<void> {
  const user = await requireUser()
  await deleteRealEstateEntry(user.id, str(fd, 'id'))
  redirect('/portfolio/vastgoed')
}
