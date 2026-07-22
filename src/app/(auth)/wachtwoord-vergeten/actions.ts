'use server'

import { z } from 'zod'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createServerSupabaseClient } from '@/lib/db/supabase-server'

const schema = z.object({
  email: z.string().min(1, 'E-mailadres is verplicht').email('Ongeldig e-mailadres'),
})

async function getOrigin() {
  const h = await headers()
  const origin = h.get('origin')
  if (origin) return origin
  const proto = h.get('x-forwarded-proto') ?? 'https'
  return `${proto}://${h.get('host')}`
}

export async function requestPasswordReset(formData: FormData) {
  const parsed = schema.safeParse({ email: formData.get('email') })
  if (!parsed.success) {
    redirect('/wachtwoord-vergeten?error=' + encodeURIComponent(parsed.error.issues[0].message))
  }

  const origin = await getOrigin()
  const supabase = await createServerSupabaseClient()
  // Zonder custom SMTP kan het e-mailtemplate niet worden aangepast naar het
  // token_hash-formaat — Supabase's eigen verify-endpoint geeft de sessie dan
  // terug als URL-fragment. Die kan alleen client-side gelezen worden, dus we
  // linken direct naar /wachtwoord-resetten (zie RecoverySessionForm).
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/wachtwoord-resetten`,
  })

  // Supabase geeft bewust geen fout terug voor een onbekend e-mailadres
  // (voorkomt dat bezoekers kunnen aftasten welke adressen geregistreerd zijn).
  if (error) {
    redirect('/wachtwoord-vergeten?error=' + encodeURIComponent(error.message))
  }

  redirect('/wachtwoord-vergeten?sent=1')
}
