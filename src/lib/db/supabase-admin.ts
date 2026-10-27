import { createClient } from '@supabase/supabase-js'

/**
 * Supabase admin client (service role) — uitsluitend voor auth-gebruikersbeheer
 * (leesaccounts voor nabestaanden aanmaken/intrekken). Nooit importeren in een
 * client component: de service-role-key omzeilt alle RLS.
 *
 * Gewone supabase-js client = implicit flow: de herstel-link levert de sessie
 * als URL-fragment, wat /wachtwoord-resetten (RecoverySessionForm) verwacht —
 * ook op het apparaat van de ontvanger (PKCE zou de verifier van de afzender vereisen).
 */
export function createAdminSupabaseClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY ontbreekt')
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
