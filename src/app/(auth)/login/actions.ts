'use server'

import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/db/supabase-server'
import { redirect } from 'next/navigation'

const signInSchema = z.object({
  email:    z.string().min(1).email(),
  password: z.string().min(1),
})

export async function signIn(formData: FormData) {
  const parsed = signInSchema.safeParse({
    email:    formData.get('email'),
    password: formData.get('password'),
  })

  if (!parsed.success) {
    redirect('/login?error=' + encodeURIComponent('E-mail of wachtwoord is onjuist'))
  }

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)

  if (error) {
    redirect('/login?error=' + encodeURIComponent('E-mail of wachtwoord is onjuist'))
  }

  redirect('/')
}

export async function signOut() {
  const supabase = await createServerSupabaseClient()
  await supabase.auth.signOut()
  redirect('/login')
}
