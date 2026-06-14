'use client'

import { useActionState, useState } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import type { ActionState } from '@/app/assets/actions'

type Props = {
  assetId: string
  currency: string
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>
  label?: string
  description?: string
  defaultValue?: number
  redirectTo?: string
}

export function ValuationForm({ assetId, currency, action, label = 'Huidige waarde registreren', description, defaultValue, redirectTo }: Props) {
  const [state, formAction, isPending] = useActionState(action, null)
  const [value, setValue] = useState(defaultValue !== undefined ? String(defaultValue) : '')
  const today = new Date().toISOString().slice(0, 10)

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="assetId" value={assetId} />
      <input type="hidden" name="currency" value={currency} />
      {redirectTo && <input type="hidden" name="redirectTo" value={redirectTo} />}

      <p className="text-sm font-medium text-foreground">{label}</p>
      {description && (
        <p className="text-xs text-muted-foreground -mt-1">{description}</p>
      )}

      {state?.error && (
        <div className="rounded-lg border border-terracotta/30 bg-terracotta/10 p-3 text-sm text-terracotta">
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
          <input
            id={`val-value-${assetId}`}
            name="value"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            value={value}
            onChange={e => setValue(e.target.value)}
            required
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
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
