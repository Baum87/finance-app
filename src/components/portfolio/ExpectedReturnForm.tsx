'use client'

import { useActionState } from 'react'
import { Label } from '@/components/ui/label'
import type { ActionState } from '@/app/assets/actions'

type Props = {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>
  category: 'stock_etf' | 'real_estate'
  title: string
  description: string
  defaultValue?: string
}

export function ExpectedReturnForm({ action, category, title, description, defaultValue }: Props) {
  const [state, formAction, isPending] = useActionState(action, null)

  return (
    <form action={formAction} className="rounded-3xl border border-border bg-card p-6 space-y-4">
      <input type="hidden" name="category" value={category} />
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground -mt-1">{description}</p>

      {state?.error && (
        <div className="rounded-lg border border-terracotta/30 bg-terracotta/10 p-3 text-sm text-terracotta">
          {state.error}
        </div>
      )}

      <div className="flex flex-col gap-1.5 max-w-[240px]">
        <Label htmlFor={`expectedAnnualReturn-${category}`}>Verwacht jaarlijks rendement (%)</Label>
        <input
          id={`expectedAnnualReturn-${category}`}
          name="expectedAnnualReturn"
          type="number"
          step="0.01"
          defaultValue={defaultValue}
          placeholder="7.00"
          className="h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {isPending ? 'Opslaan…' : 'Opslaan'}
      </button>
    </form>
  )
}
