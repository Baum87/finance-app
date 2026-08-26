'use client'

import { useActionState, useState } from 'react'
import { Label } from '@/components/ui/label'
import type { ActionState } from '@/app/assets/actions'

type Props = {
  assetId: string
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>
  redirectTo?: string
}

export function RecurringCashflowForm({ assetId, action, redirectTo }: Props) {
  const [state, formAction, isPending] = useActionState(action, null)
  const [frequency, setFrequency] = useState<'monthly' | 'once'>('monthly')
  const today = new Date().toISOString().slice(0, 10)

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="assetId" value={assetId} />
      {redirectTo && <input type="hidden" name="redirectTo" value={redirectTo} />}

      <p className="text-sm font-medium text-foreground">Huur of kosten toevoegen</p>
      <p className="text-xs text-muted-foreground -mt-1">
        Voor een bedrag dat een tijd lang hetzelfde blijft — 1 rij in plaats van elke maand een
        losse transactie. Verandert het bedrag later? Sluit deze periode af (tot-datum) en voeg een
        nieuwe toe.
      </p>

      {state?.error && (
        <div className="rounded-lg border border-terracotta/30 bg-terracotta/10 p-3 text-sm text-terracotta">
          {state.error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`rc-type-${assetId}`}>Type<span className="text-terracotta ml-0.5">*</span></Label>
          <select
            id={`rc-type-${assetId}`}
            name="cashflowType"
            defaultValue="rental_income"
            className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm transition-colors"
          >
            <option value="rental_income">Huurinkomst</option>
            <option value="cost">Kosten (bijv. VvE)</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`rc-freq-${assetId}`}>Frequentie<span className="text-terracotta ml-0.5">*</span></Label>
          <select
            id={`rc-freq-${assetId}`}
            name="frequency"
            value={frequency}
            onChange={e => setFrequency(e.target.value as 'monthly' | 'once')}
            className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm transition-colors"
          >
            <option value="monthly">Maandelijks</option>
            <option value="once">Eenmalig</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`rc-amount-${assetId}`}>
            {frequency === 'monthly' ? 'Bedrag per maand (€)' : 'Bedrag (€)'}
            <span className="text-terracotta ml-0.5">*</span>
          </Label>
          <input
            id={`rc-amount-${assetId}`}
            name="amount"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            required
            className="h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`rc-start-${assetId}`}>
            {frequency === 'monthly' ? 'Vanaf datum' : 'Datum'}
            <span className="text-terracotta ml-0.5">*</span>
          </Label>
          <input
            id={`rc-start-${assetId}`}
            name="startDate"
            type="date"
            defaultValue={today}
            required
            className="h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>

        {frequency === 'monthly' && (
          <div className="flex flex-col gap-1.5 col-span-2">
            <Label htmlFor={`rc-end-${assetId}`}>Tot en met datum</Label>
            <input
              id={`rc-end-${assetId}`}
              name="endDate"
              type="date"
              className="h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
            <p className="text-xs text-muted-foreground">Leeg laten = nog actief / doorlopend.</p>
          </div>
        )}
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
