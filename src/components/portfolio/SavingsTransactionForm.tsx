'use client'

import { useActionState, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ActionState } from '@/app/assets/actions'

type Props = {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>
  assetId: string
  redirectTo: string
  defaultMonthlyAmount?: string | null
}

export function SavingsTransactionForm({ action, assetId, redirectTo, defaultMonthlyAmount }: Props) {
  const [state, formAction, isPending] = useActionState(action, null)
  const [isRecurring, setIsRecurring] = useState(false)
  const today = new Date().toISOString().slice(0, 10)

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="assetId" value={assetId} />
      <input type="hidden" name="redirectTo" value={redirectTo} />

      {state?.error && (
        <div className="rounded-lg border border-terracotta/30 bg-terracotta/10 p-3 text-sm text-terracotta">
          {state.error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {/* Type */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="transactionType">Type <span className="text-terracotta">*</span></Label>
          <select
            name="transactionType"
            id="transactionType"
            defaultValue="deposit"
            className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm transition-colors"
          >
            <option value="deposit">Storting</option>
            <option value="withdrawal">Opname</option>
          </select>
        </div>

        {/* Datum */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="transactionDate">Datum <span className="text-terracotta">*</span></Label>
          <Input
            id="transactionDate"
            name="transactionDate"
            type="date"
            defaultValue={today}
            required
          />
        </div>

        {/* Bedrag */}
        <div className="flex flex-col gap-1.5 col-span-2">
          <Label htmlFor="amount">Bedrag (EUR) <span className="text-terracotta">*</span></Label>
          <Input
            id="amount"
            name="amount"
            type="text"
            inputMode="decimal"
            placeholder="500.00"
            defaultValue={defaultMonthlyAmount ?? undefined}
            required
          />
        </div>

        {/* Notitie */}
        <div className="flex flex-col gap-1.5 col-span-2">
          <Label htmlFor="notes">Notitie</Label>
          <Input
            id="notes"
            name="notes"
            type="text"
            placeholder="Maandelijkse inleg"
          />
        </div>
      </div>

      {/* Recurring */}
      <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            name="recurring"
            value="on"
            checked={isRecurring}
            onChange={e => setIsRecurring(e.target.checked)}
            className="w-4 h-4 rounded border-border accent-primary"
          />
          <span className="text-sm font-medium text-foreground">Maandelijks herhalen</span>
        </label>
        {isRecurring && (
          <p className="text-xs text-muted-foreground pl-7">
            Dit bedrag wordt opgeslagen als maandelijks terugkerend bedrag. Je kunt het de volgende maand met één klik toepassen vanuit de rekening-overzichtspagina.
          </p>
        )}
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {isPending ? 'Opslaan…' : 'Opslaan'}
        </button>
        <a
          href={redirectTo}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Annuleren
        </a>
      </div>
    </form>
  )
}
