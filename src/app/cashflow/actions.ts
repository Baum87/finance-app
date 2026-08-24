'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/db/supabase-server'
import { createRecurringItem, updateRecurringItem, deleteRecurringItem } from '@/lib/db/queries/recurring-items'
import type { ActionState } from '@/app/assets/actions'

const RecurringItemSchema = z.object({
  name:          z.string().min(1, 'Naam is verplicht'),
  itemType:      z.enum(['income', 'expense']),
  category:      z.enum(['salary', 'insurance', 'subscription', 'mortgage', 'municipal_tax', 'groceries', 'other']),
  amount:        z.string().regex(/^\d+(\.\d{1,2})?$/, 'Ongeldig bedrag'),
  frequency:     z.enum(['monthly', 'four_weekly', 'quarterly', 'yearly']),
  // Alleen vereist bij bewerken (nieuw bedrag krijgt een ingangsdatum). Bij
  // aanmaken wordt de datum van vandaag gebruikt, niet uit het formulier.
  effectiveDate: z.string().min(1, 'Ingangsdatum is verplicht').optional(),
})

export async function createRecurringItemAction(formData: FormData): Promise<ActionState> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const parsed = RecurringItemSchema.safeParse({
    name:      formData.get('name'),
    itemType:  formData.get('itemType'),
    category:  formData.get('category'),
    amount:    formData.get('amount'),
    frequency: formData.get('frequency'),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues.map(i => i.message).join(', ') }
  }

  await createRecurringItem(user.id, { ...parsed.data, effectiveDate: new Date().toISOString().slice(0, 10) })
  revalidatePath('/cashflow')
  return null
}

export async function updateRecurringItemAction(formData: FormData) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const itemId = formData.get('itemId') as string
  if (!itemId) throw new Error('Geen post-ID opgegeven')

  const parsed = RecurringItemSchema.safeParse({
    name:          formData.get('name'),
    itemType:      formData.get('itemType'),
    category:      formData.get('category'),
    amount:        formData.get('amount'),
    frequency:     formData.get('frequency'),
    effectiveDate: formData.get('effectiveDate'),
  })
  if (!parsed.success) return

  // effectiveDate ontbreekt in het formulier als het bedrag niet is gewijzigd
  // (dan wordt er sowieso geen nieuwe bedrag-historie aangemaakt) — val in dat
  // geval terug op vandaag, puur als placeholder die niet gebruikt wordt.
  const effectiveDate = parsed.data.effectiveDate ?? new Date().toISOString().slice(0, 10)

  await updateRecurringItem(user.id, itemId, { ...parsed.data, effectiveDate })
  revalidatePath('/cashflow')
}

export async function deleteRecurringItemAction(formData: FormData) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const itemId = formData.get('itemId') as string
  if (!itemId) throw new Error('Geen post-ID opgegeven')

  await deleteRecurringItem(user.id, itemId)
  revalidatePath('/cashflow')
}
