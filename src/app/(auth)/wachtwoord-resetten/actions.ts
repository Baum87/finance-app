'use server'

import { z } from 'zod'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/db/supabase-server'

const schema = z
  .object({
    password: z.string().min(8, 'Wachtwoord moet minimaal 8 tekens zijn'),
    passwordConfirm: z.string(),
  })
  .refine((d) => d.password === d.passwordConfirm, {
    message: 'Wachtwoorden komen niet overeen',
    path: ['passwordConfirm'],
  })

export async function updatePassword(formData: FormData) {
  const parsed = schema.safeParse({
    password: formData.get('password'),
    passwordConfirm: formData.get('passwordConfirm'),
  })
  if (!parsed.success) {
    redirect('/wachtwoord-resetten?error=' + encodeURIComponent(parsed.error.issues[0].message))
  }

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login?error=' + encodeURIComponent('Reset-sessie verlopen, vraag een nieuwe link aan'))
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })
  if (error) {
    redirect('/wachtwoord-resetten?error=' + encodeURIComponent(error.message))
  }

  redirect('/')
}
