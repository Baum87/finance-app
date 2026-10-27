'use server'

import { z } from 'zod'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/db/supabase-server'
import { getRequestOrigin } from '@/lib/utils/request-origin'

const schema = z.object({
  email: z.string().min(1, 'E-mailadres is verplicht').email('Ongeldig e-mailadres'),
})

export async function requestPasswordReset(formData: FormData) {
  const parsed = schema.safeParse({ email: formData.get('email') })
  if (!parsed.success) {
    redirect('/wachtwoord-vergeten?error=' + encodeURIComponent(parsed.error.issues[0].message))
  }

  const origin = await getRequestOrigin()
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
