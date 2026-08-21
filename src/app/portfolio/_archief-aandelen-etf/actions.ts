'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/db/supabase-server'
import { createBroker, deleteBroker } from '@/lib/db/queries/brokers'

async function requireUser() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return user
}

const brokerSchema = z.object({
  name: z.string().min(1, 'Naam is verplicht'),
})

export type BrokerActionState = { error: string } | null

export async function createBrokerAction(prev: BrokerActionState, fd: FormData): Promise<BrokerActionState> {
  try {
    const user = await requireUser()
    const { name } = brokerSchema.parse({ name: fd.get('name') as string })
    await createBroker(user.id, name)
    redirect('/portfolio/aandelen-etf')
  } catch (e: any) {
    if (e?.digest?.startsWith('NEXT_REDIRECT')) throw e
    if (e instanceof z.ZodError) return { error: e.issues[0].message }
    return { error: e instanceof Error ? e.message : 'Onbekende fout' }
  }
}

export async function deleteBrokerAction(fd: FormData): Promise<void> {
  const user = await requireUser()
  const brokerId = fd.get('brokerId') as string
  await deleteBroker(user.id, brokerId)
  redirect('/portfolio/aandelen-etf')
}
