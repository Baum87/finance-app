'use client'

import { useActionState } from 'react'
import { Label } from '@/components/ui/label'
import type { ActionState } from '@/app/assets/actions'

type Props = {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>
}

export function StockAnnualReturnForm({ action }: Props) {
  const [state, formAction, isPending] = useActionState(action, null)
  const currentYear = new Date().getFullYear()

  return (
    <form action={formAction} className="rounded-3xl border border-border bg-card p-6 space-y-4">
      <p className="text-sm font-medium text-foreground">Werkelijk rendement per jaar</p>
      <p className="text-xs text-muted-foreground -mt-1">
        Stel aan het eind van het jaar vast wat het werkelijke rendement is geweest — een los
        cijfer dat je zelf bepaalt, niet automatisch berekend uit transacties.
      </p>

      {state?.error && (
        <div className="rounded-lg border border-terracotta/30 bg-terracotta/10 p-3 text-sm text-terracotta">
          {state.error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 max-w-[400px]">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="year">Jaar</Label>
          <input
            id="year"
            name="year"
            type="number"
            step="1"
            defaultValue={currentYear}
            className="h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="returnPct">Rendement (%)</Label>
          <input
            id="returnPct"
            name="returnPct"
            type="number"
            step="0.01"
            placeholder="8.20"
            className="h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>
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
