'use client'

import { useActionState } from 'react'
import { saveDossierItemAction } from '@/app/dossier/actions'
import type { DossierKind } from '@/lib/db/queries/dossier'
import { DOSSIER_SECTIONS, type DossierField } from './dossier-fields'

type Props = {
  kind: DossierKind
  /** Bestaand item → bewerkformulier; zonder → toevoegformulier. */
  item?: { id: string } & Record<string, unknown>
}

const inputClass =
  'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary'

function defaultValueOf(item: Props['item'], field: DossierField): string {
  const v = item?.[field.name]
  if (typeof v === 'string') return v
  if (field.type === 'select' && field.options) return Object.keys(field.options)[0]
  return ''
}

export function DossierItemForm({ kind, item }: Props) {
  const [state, formAction, isPending] = useActionState(saveDossierItemAction, null)
  const section = DOSSIER_SECTIONS[kind]
  const isEdit = item != null

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="kind" value={kind} />
      {isEdit && <input type="hidden" name="id" value={item.id} />}

      {state?.error && (
        <div className="rounded-lg border border-terracotta/30 bg-terracotta/10 p-3 text-sm text-terracotta">
          {state.error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {section.fields.map(field => {
          const id = `${kind}-${item?.id ?? 'new'}-${field.name}`
          const defaultValue = defaultValueOf(item, field)
          return (
            <div key={field.name} className={`space-y-1 ${field.type === 'textarea' ? 'md:col-span-2' : ''}`}>
              <label htmlFor={id} className="text-xs text-muted-foreground">
                {field.label}{field.required ? '' : ' (optioneel)'}
              </label>
              {field.type === 'select' ? (
                <select id={id} name={field.name} defaultValue={defaultValue} required={field.required} className={inputClass}>
                  {Object.entries(field.options ?? {}).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              ) : field.type === 'textarea' ? (
                <textarea id={id} name={field.name} rows={3} defaultValue={defaultValue} placeholder={field.placeholder} className={inputClass} />
              ) : (
                <input
                  id={id}
                  name={field.name}
                  type={field.type === 'money' ? 'number' : field.type}
                  step={field.type === 'money' ? '0.01' : undefined}
                  defaultValue={defaultValue}
                  required={field.required}
                  placeholder={field.placeholder}
                  className={inputClass}
                />
              )}
            </div>
          )
        })}
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {isPending ? 'Opslaan…' : isEdit ? 'Opslaan' : 'Toevoegen'}
        </button>
      </div>
    </form>
  )
}
