'use client'

import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/db/supabase'
import { updatePassword } from './actions'

type Status = 'checking' | 'ready' | 'invalid'

// Supabase's ingebouwde e-mailservice (zonder custom SMTP) laat het
// e-mailtemplate niet aanpassen naar het token_hash-formaat. De reset-link
// verwijst daardoor naar Supabase's eigen verify-endpoint, dat na verificatie
// de sessie als URL-fragment (#access_token=...) teruggeeft — fragments komen
// nooit bij de server aan, dus die sessie moet hier client-side opgehaald worden.
export function RecoverySessionForm({ actionError }: { actionError?: string }) {
  const [status, setStatus] = useState<Status>('checking')
  const [linkError, setLinkError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function resolveSession() {
      // Yield eerst een tick — setState mag niet synchroon binnen de effect-body
      // plaatsvinden (react-hooks/set-state-in-effect).
      await Promise.resolve()

      const supabase = createClient()
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
      const accessToken = hash.get('access_token')
      const refreshToken = hash.get('refresh_token')
      const hashError = hash.get('error_description')

      if (window.location.hash) {
        history.replaceState(null, '', window.location.pathname + window.location.search)
      }

      if (cancelled) return

      if (hashError) {
        setLinkError(decodeURIComponent(hashError.replace(/\+/g, ' ')))
        setStatus('invalid')
        return
      }

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
        if (!cancelled) setStatus(error ? 'invalid' : 'ready')
        return
      }

      // Geen tokens in de link (bijv. al eerder client-side afgehandeld) — check op bestaande sessie
      const { data } = await supabase.auth.getUser()
      if (!cancelled) setStatus(data.user ? 'ready' : 'invalid')
    }

    resolveSession()
    return () => { cancelled = true }
  }, [])

  if (status === 'checking') {
    return <p className="text-sm text-muted-foreground">Link controleren…</p>
  }

  if (status === 'invalid') {
    return (
      <p className="text-sm text-destructive">
        {linkError ?? 'Deze reset-link is ongeldig of verlopen.'} Vraag een nieuwe aan via{' '}
        <a href="/wachtwoord-vergeten" className="underline">wachtwoord vergeten</a>.
      </p>
    )
  }

  return (
    <form action={updatePassword} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Nieuw wachtwoord</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="passwordConfirm">Bevestig wachtwoord</Label>
        <Input id="passwordConfirm" name="passwordConfirm" type="password" autoComplete="new-password" required minLength={8} />
      </div>
      {actionError && (
        <p className="text-sm text-destructive">{decodeURIComponent(actionError)}</p>
      )}
      <Button type="submit" className="w-full">Wachtwoord opslaan</Button>
    </form>
  )
}
