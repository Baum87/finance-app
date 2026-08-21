'use client'

import { useActionState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export type ActionState = { error: string } | null

type FieldConfig = {
  name: string
  label: string
  type?: 'text' | 'number' | 'date'
  placeholder?: string
}

type Props = {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>
  fields: FieldConfig[]
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

export function EntryLogForm({ action, fields }: Props) {
  const [state, formAction, isPending] = useActionState(action, null)

  return (
    <form action={formAction} className="bg-card border border-border rounded-3xl p-6 space-y-4">
      {state?.error && (
        <div className="rounded-lg border border-terracotta/30 bg-terracotta/10 p-3 text-sm text-terracotta">
          {state.error}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {fields.map(f => (
          <div key={f.name} className="flex flex-col gap-1.5">
            <Label htmlFor={f.name}>{f.label}</Label>
            <Input
              id={f.name}
              name={f.name}
              type={f.type ?? 'text'}
              placeholder={f.placeholder}
              defaultValue={f.type === 'date' ? todayIso() : undefined}
            />
          </div>
        ))}
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {isPending ? 'Toevoegen…' : '+ Toevoegen'}
      </button>
    </form>
  )
}
