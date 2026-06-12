'use client'

import { useRef } from 'react'

const LIABILITY_TYPE_LABELS: Record<string, string> = {
  student_loan:   'Studieschuld',
  personal_loan:  'Persoonlijke lening',
  other:          'Overig',
}

interface LiabilityFormProps {
  action: (formData: FormData) => Promise<void>
}

export function LiabilityForm({ action }: LiabilityFormProps) {
  const formRef = useRef<HTMLFormElement>(null)

  async function handleSubmit(formData: FormData) {
    await action(formData)
    formRef.current?.reset()
  }

  return (
    <form ref={formRef} action={handleSubmit} className="bg-card border border-border rounded-3xl p-6 space-y-4">
      <p className="text-sm font-medium text-foreground">Schuld toevoegen</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Naam</label>
          <input
            name="name"
            required
            placeholder="bijv. DUO-lening"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Type</label>
          <select
            name="liabilityType"
            required
            defaultValue="personal_loan"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {Object.entries(LIABILITY_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Openstaand bedrag (€)</label>
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
          <label className="text-xs text-muted-foreground">Rente (% per jaar, optioneel)</label>
          <input
            name="interestRate"
            type="number"
            step="0.01"
            min="0"
            placeholder="bijv. 2.5"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Startdatum (optioneel)</label>
          <input
            name="startDate"
            type="date"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Einddatum (optioneel)</label>
          <input
            name="endDate"
            type="date"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      <div className="flex justify-end">
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
