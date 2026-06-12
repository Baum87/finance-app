'use client'

import { useActionState } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import type { ActionState } from '@/app/assets/actions'

type Props = {
  assetId: string
  currency: string
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>
  label?: string
}

export function ValuationForm({ assetId, currency, action, label = 'Huidige waarde registreren' }: Props) {
  const [state, formAction, isPending] = useActionState(action, null)
  const today = new Date().toISOString().slice(0, 10)

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="assetId" value={assetId} />
      <input type="hidden" name="currency" value={currency} />

      <p className="text-sm font-medium text-foreground">{label}</p>

      {state?.error && (
        <div className="rounded-xl border border-terracotta/30 bg-terracotta/10 p-3 text-sm text-terracotta">
          {state.error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`val-date-${assetId}`}>
            Datum <span className="text-terracotta">*</span>
          </Label>
          <Input
            id={`val-date-${assetId}`}
            name="valuationDate"
            type="date"
            defaultValue={today}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`val-value-${assetId}`}>
            Waarde ({currency}) <span className="text-terracotta">*</span>
          </Label>
          <Input
            id={`val-value-${assetId}`}
            name="value"
            type="number"
            step="0.01"
            min="0"
            placeholder="45000.00"
            required
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
