'use client'

import { deleteValuationAction } from '@/app/assets/actions'

type Props = {
  valuationId: string
  redirectTo: string
}

export function DeleteValuationButton({ valuationId, redirectTo }: Props) {
  return (
    <form action={deleteValuationAction}>
      <input type="hidden" name="valuationId" value={valuationId} />
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <button
        type="submit"
        onClick={e => { if (!confirm('Snapshot verwijderen?')) e.preventDefault() }}
        className="text-xs text-terracotta hover:opacity-70 transition-opacity"
      >
        Verwijderen
      </button>
    </form>
  )
}
