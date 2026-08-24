'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/db/supabase-server'
import { createRecurringItem, deleteRecurringItem } from '@/lib/db/queries/recurring-items'
import type { ActionState } from '@/app/assets/actions'

const RecurringItemSchema = z.object({
  name:      z.string().min(1, 'Naam is verplicht'),
  itemType:  z.enum(['income', 'expense']),
  category:  z.enum(['salary', 'insurance', 'subscription', 'mortgage', 'municipal_tax', 'groceries', 'other']),
  amount:    z.string().regex(/^\d+(\.\d{1,2})?$/, 'Ongeldig bedrag'),
  frequency: z.enum(['monthly', 'quarterly', 'yearly']),
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

  await createRecurringItem(user.id, parsed.data)
  revalidatePath('/cashflow')
  return null
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
