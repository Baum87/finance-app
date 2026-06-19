'use server'

import { redirect } from 'next/navigation'
import { isRedirectError } from 'next/dist/client/components/redirect-error'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { createServerSupabaseClient } from '@/lib/db/supabase-server'
import { createTransaction } from '@/lib/db/queries/transactions'
import { db } from '@/lib/db'
import { savingsDetails } from '@/lib/db/schema'
import type { ActionState } from '@/app/assets/actions'

const savingsTxSchema = z.object({
  transactionType: z.enum(['deposit', 'withdrawal', 'interest']),
  amount:          z.string().min(1, 'Bedrag is verplicht'),
  transactionDate: z.string().min(1, 'Datum is verplicht'),
  notes:           z.string().optional(),
  recurring:       z.string().optional(), // 'on' als checkbox aangevinkt
})

function str(fd: FormData, key: string) {
  return (fd.get(key) as string | null) ?? ''
}

export async function createSavingsTransactionAction(
  prev: ActionState,
  fd: FormData,
): Promise<ActionState> {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const assetId    = str(fd, 'assetId')
    const redirectTo = str(fd, 'redirectTo') || `/portfolio/spaarrekeningen/${assetId}`

    const data = savingsTxSchema.parse({
      transactionType: str(fd, 'transactionType'),
      amount:          str(fd, 'amount'),
      transactionDate: str(fd, 'transactionDate'),
      notes:           str(fd, 'notes') || undefined,
      recurring:       str(fd, 'recurring') || undefined,
    })

    await createTransaction(user.id, assetId, {
      transactionType: data.transactionType,
      amount:          data.amount,
      transactionDate: data.transactionDate,
      currency:        'EUR',
      fxRate:          '1',
      notes:           data.notes ?? null,
    })

    // Bewaar als maandelijks bedrag als recurring aangevinkt
    if (data.recurring === 'on') {
      await db
        .update(savingsDetails)
        .set({ monthlyDepositAmount: data.amount })
        .where(eq(savingsDetails.assetId, assetId))
    }

    redirect(redirectTo)
  } catch (e) {
    if (isRedirectError(e)) throw e
    if (e instanceof z.ZodError) return { error: e.issues[0].message }
    return { error: e instanceof Error ? e.message : 'Onbekende fout' }
  }
}

export async function applyMonthlyDepositAction(fd: FormData): Promise<void> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const assetId = fd.get('assetId') as string
  const amount  = fd.get('amount') as string
  const today   = new Date().toISOString().slice(0, 10)

  await createTransaction(user.id, assetId, {
    transactionType: 'deposit',
    amount,
    transactionDate: today,
    currency:        'EUR',
    fxRate:          '1',
    notes:           `Maandelijkse storting ${new Date().toLocaleString('nl-NL', { month: 'long', year: 'numeric' })}`,
  })

  redirect(`/portfolio/spaarrekeningen/${assetId}`)
}
