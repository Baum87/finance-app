'use client'

import { useActionState } from 'react'
import { inviteDossierViewerAction } from '@/app/dossier/actions'

export function ViewerInviteForm() {
  const [state, formAction, isPending] = useActionState(inviteDossierViewerAction, null)

  return (
    <form action={formAction} className="space-y-3">
      <p className="text-sm font-medium text-foreground">Nabestaande uitnodigen</p>
      <p className="text-xs text-muted-foreground">
        Diegene krijgt een e-mail om een wachtwoord in te stellen en kan daarna alleen dit dossier inzien,
        niet bewerken. De link in de e-mail is beperkt geldig; verstuur hem zo nodig opnieuw.
      </p>
      {state?.error && (
        <div className="rounded-lg border border-terracotta/30 bg-terracotta/10 p-3 text-sm text-terracotta">
          {state.error}
        </div>
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          name="email"
          type="email"
          required
          placeholder="naam@voorbeeld.nl"
          aria-label="E-mailadres"
          className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {isPending ? 'Uitnodigen…' : 'Uitnodigen'}
        </button>
      </div>
    </form>
  )
}
