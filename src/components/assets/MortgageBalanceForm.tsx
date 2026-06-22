'use client'

import { useActionState } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { formatCurrency } from '@/lib/utils/format'
import type { ActionState } from '@/app/assets/actions'

type Props = {
  assetId: string
  mortgageId: string
  lender: string
  originalAmount: string
  interestRate: string
  endDate?: string | null
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>
}

function formatEndDate(dateStr: string): string {
  return new Intl.DateTimeFormat('nl-NL', {
    day: 'numeric', month: 'short', year: 'numeric',
  }).format(new Date(dateStr + 'T00:00:00'))
}

export function MortgageBalanceForm({ assetId, mortgageId, lender, originalAmount, interestRate, endDate, action }: Props) {
  const [state, formAction, isPending] = useActionState(action, null)
  const today = new Date().toISOString().slice(0, 10)

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="assetId" value={assetId} />
      <input type="hidden" name="mortgageId" value={mortgageId} />

      <div>
        <p className="text-sm font-medium text-foreground">Hypotheeksaldo bijwerken</p>
        <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
          <span>{lender}</span>
          <span>Oorspronkelijk: {formatCurrency(Number(originalAmount))}</span>
          <span>Rente: {interestRate}%</span>
          {endDate && <span>Looptijd tot: {formatEndDate(endDate)}</span>}
        </div>
      </div>

      {state?.error && (
        <div className="rounded-lg border border-terracotta/30 bg-terracotta/10 p-3 text-sm text-terracotta">
          {state.error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`mb-date-${mortgageId}`}>
            Datum <span className="text-terracotta">*</span>
          </Label>
          <Input
            id={`mb-date-${mortgageId}`}
            name="balanceDate"
            type="date"
            defaultValue={today}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`mb-balance-${mortgageId}`}>
            Restschuld (EUR) <span className="text-terracotta">*</span>
          </Label>
          <Input
            id={`mb-balance-${mortgageId}`}
            name="outstandingBalance"
            type="number"
            step="0.01"
            min="0"
            placeholder="285000.00"
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
