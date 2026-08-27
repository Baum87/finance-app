'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireUser } from '@/lib/db/supabase-server'
import {
  saveInvestmentAssumption, createStockAnnualReturn, updateStockAnnualReturn, deleteStockAnnualReturn,
} from '@/lib/db/queries/investment-assumptions'
import type { ActionState } from '@/app/assets/actions'

const PERCENT_REGEX = /^-?\d+(\.\d{1,2})?$/

const assumptionSchema = z.object({
  expectedAnnualReturn: z.string().regex(PERCENT_REGEX, 'Verwacht rendement moet een getal zijn, bijv. 7 of -2.5'),
})

const annualReturnSchema = z.object({
  year:      z.coerce.number().int().min(1990, 'Jaar moet 1990 of later zijn').max(2100, 'Jaar moet 2100 of eerder zijn'),
  returnPct: z.string().regex(PERCENT_REGEX, 'Rendement moet een getal zijn, bijv. 8.2 of -3'),
})

function str(fd: FormData, key: string): string {
  return (fd.get(key) as string | null) ?? ''
}

function revalidateAandelenPages() {
  revalidatePath('/portfolio/aandelen-etf')
  revalidatePath('/')
}

export async function saveInvestmentAssumptionAction(prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireUser()
    const data = assumptionSchema.parse({ expectedAnnualReturn: str(fd, 'expectedAnnualReturn') })
    await saveInvestmentAssumption(user.id, data.expectedAnnualReturn)
    revalidateAandelenPages()
    return null
  } catch (e) {
    if (e instanceof z.ZodError) return { error: e.issues[0].message }
    return { error: e instanceof Error ? e.message : 'Onbekende fout' }
  }
}

export async function createStockAnnualReturnAction(prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireUser()
    const data = annualReturnSchema.parse({ year: str(fd, 'year'), returnPct: str(fd, 'returnPct') })
    await createStockAnnualReturn(user.id, data)
    revalidateAandelenPages()
    return null
  } catch (e) {
    if (e instanceof z.ZodError) return { error: e.issues[0].message }
    return { error: e instanceof Error ? e.message : 'Onbekende fout' }
  }
}

export async function updateStockAnnualReturnAction(fd: FormData): Promise<void> {
  const user = await requireUser()
  const id = str(fd, 'id')
  const data = annualReturnSchema.parse({ year: str(fd, 'year'), returnPct: str(fd, 'returnPct') })
  await updateStockAnnualReturn(user.id, id, data)
  revalidateAandelenPages()
}

export async function deleteStockAnnualReturnAction(fd: FormData): Promise<void> {
  const user = await requireUser()
  const id = fd.get('id') as string
  await deleteStockAnnualReturn(user.id, id)
  revalidateAandelenPages()
}
