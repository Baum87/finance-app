'use client'

import { useRef, useState } from 'react'
import type { ActionState } from '@/app/assets/actions'

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

interface OneTimeExpenseFormProps {
  action: (formData: FormData) => Promise<ActionState>
}

export function OneTimeExpenseForm({ action }: OneTimeExpenseFormProps) {
  const formRef = useRef<HTMLFormElement>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(formData: FormData) {
    const result = await action(formData)
    if (result?.error) {
      setError(result.error)
      return
    }
    setError(null)
    formRef.current?.reset()
  }

  return (
    <form ref={formRef} action={handleSubmit} className="bg-card border border-border rounded-3xl p-6 space-y-4">
      <p className="text-sm font-medium text-foreground">Eenmalige uitgave toevoegen</p>

      {error && (
        <div className="rounded-lg border border-terracotta/30 bg-terracotta/10 p-3 text-sm text-terracotta">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Naam</label>
          <input
            name="name"
            required
            placeholder="bijv. Nieuwe bank"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Bedrag (€)</label>
          <input
            name="amount"
            type="number"
            step="0.01"
            min="0"
            required
            placeholder="0.00"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Datum</label>
          <input
            name="expenseDate"
            type="date"
            required
            defaultValue={todayIso()}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            name="isShared"
            className="rounded border-border text-sage focus:ring-1 focus:ring-primary"
          />
          Gezamenlijk betaald (bijv. vanaf een gedeelde rekening)
        </label>

        <button
          type="submit"
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Toevoegen
        </button>
      </div>
    </form>
  )
}
