'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireUser } from '@/lib/db/supabase-server'
import { saveGoal, deleteGoal } from '@/lib/db/queries/goals'
import type { ActionState } from '@/app/assets/actions'

// targetAmount is alleen verplicht bij 'savings'/'net_worth' — het derde
// doeltype (passive_income_coverage) streeft altijd naar 100% dekkingsgraad
// en heeft geen apart bedrag nodig.
const GoalSchema = z.object({
  name:         z.string().min(1, 'Naam is verplicht'),
  goalType:     z.enum(['savings', 'net_worth', 'passive_income_coverage']),
  targetAmount: z.string().nullish(),
  targetDate:   z.string().nullish(),
}).refine(
  d => d.goalType === 'passive_income_coverage' || (!!d.targetAmount && /^\d+(\.\d{1,2})?$/.test(d.targetAmount) && Number(d.targetAmount) > 0),
  { message: 'Doelbedrag is verplicht en moet groter dan 0 zijn', path: ['targetAmount'] },
)

export async function saveGoalAction(prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser()

  const parsed = GoalSchema.safeParse({
    name:         formData.get('name'),
    goalType:     formData.get('goalType'),
    targetAmount: formData.get('targetAmount'),
    targetDate:   formData.get('targetDate'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues.map(i => i.message).join(', ') }
  }

  await saveGoal(user.id, {
    name:         parsed.data.name,
    goalType:     parsed.data.goalType,
    targetAmount: parsed.data.goalType === 'passive_income_coverage' ? null : (parsed.data.targetAmount ?? null),
    targetDate:   parsed.data.targetDate || null,
  })
  revalidatePath('/')
  return null
}

export async function deleteGoalAction(): Promise<void> {
  const user = await requireUser()
  await deleteGoal(user.id)
  revalidatePath('/')
}
