'use client'

import { useActionState } from 'react'
import { saveDossierNoteAction } from '@/app/dossier/actions'
import type { DossierNoteTopic } from '@/lib/db/queries/dossier'
import { NOTE_TOPICS } from './dossier-fields'

type Props = {
  topic: DossierNoteTopic
  body: string | undefined
}

export function DossierNoteForm({ topic, body }: Props) {
  const [state, formAction, isPending] = useActionState(saveDossierNoteAction, null)
  const { label, hint } = NOTE_TOPICS[topic]
  const id = `note-${topic}`

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="topic" value={topic} />
      <label htmlFor={id} className="text-sm font-medium text-foreground">{label}</label>
      <p className={`text-xs ${topic === 'digital_legacy' ? 'text-terracotta' : 'text-muted-foreground'}`}>{hint}</p>
      {state?.error && <p className="text-sm text-terracotta">{state.error}</p>}
      <textarea
        id={id}
        name="body"
        rows={4}
        defaultValue={body ?? ''}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
      />
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
        >
          {isPending ? 'Opslaan…' : 'Opslaan'}
        </button>
      </div>
    </form>
  )
}
