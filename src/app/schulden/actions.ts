'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireUser } from '@/lib/db/supabase-server'
import { createLiability, deleteLiability } from '@/lib/db/queries/liabilities'

const LiabilitySchema = z.object({
  name:          z.string().min(1, 'Naam is verplicht'),
  liabilityType: z.enum(['student_loan', 'personal_loan', 'other']),
  amount:        z.string().regex(/^\d+(\.\d{1,2})?$/, 'Ongeldig bedrag'),
  interestRate:  z.string().regex(/^\d+(\.\d{1,4})?$/, 'Ongeldig rentepercentage').optional().nullable(),
  startDate:     z.string().optional().nullable(),
  endDate:       z.string().optional().nullable(),
  currency:      z.string().default('EUR'),
})

export async function createLiabilityAction(formData: FormData) {
  const user = await requireUser()

  const parsed = LiabilitySchema.safeParse({
    name:          formData.get('name'),
    liabilityType: formData.get('liabilityType'),
    amount:        formData.get('amount'),
    interestRate:  formData.get('interestRate') || null,
    startDate:     formData.get('startDate') || null,
    endDate:       formData.get('endDate') || null,
    currency:      formData.get('currency') || 'EUR',
  })

  if (!parsed.success) {
    throw new Error(parsed.error.issues.map(i => i.message).join(', '))
  }

  await createLiability(user.id, parsed.data)
  revalidatePath('/schulden')
}

export async function deleteLiabilityAction(formData: FormData) {
  const user = await requireUser()

  const liabilityId = formData.get('liabilityId') as string
  if (!liabilityId) throw new Error('Geen schuld-ID opgegeven')

  await deleteLiability(user.id, liabilityId)
  revalidatePath('/schulden')
}
