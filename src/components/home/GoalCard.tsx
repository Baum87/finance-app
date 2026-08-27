'use client'

import { useActionState, useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { saveGoalAction, deleteGoalAction } from '@/app/actions'
import { formatCurrency, formatPercent } from '@/lib/utils/format'

type GoalType = 'savings' | 'net_worth' | 'passive_income_coverage'

export type GoalCardGoal = {
  name: string
  goalType: GoalType
  targetAmount: string | null
  targetDate: string | null
}

export type GoalCardProgress = {
  currentValue: number
  targetValue: number
  percentage: number
} | null

export type GoalCardProjection = {
  value: number
  date: string
  ratePct: number
} | null

type Props = {
  goal: GoalCardGoal | null
  progress: GoalCardProgress
  projection?: GoalCardProjection
}

const GOAL_TYPE_LABELS: Record<GoalType, string> = {
  savings:                  'Spaardoel',
  net_worth:                'Vermogensdoel',
  passive_income_coverage:  'FI-dekkingsgraad (passief inkomen)',
}

function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(dateStr + 'T00:00:00'))
}

export function GoalCard({ goal, progress, projection }: Props) {
  const [editing, setEditing] = useState(!goal)
  const [goalType, setGoalType] = useState<GoalType>(goal?.goalType ?? 'net_worth')
  const [state, formAction, isPending] = useActionState(saveGoalAction, null)

  if (!editing && goal) {
    return (
      <div className="bg-card border border-border rounded-3xl p-6">
        <div className="flex items-start justify-between">
          <p className="text-sm font-medium text-muted-foreground">Actief doel</p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setEditing(true)}
              aria-label="Doel bewerken"
              title="Doel bewerken"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <Pencil size={14} />
            </button>
            <form action={deleteGoalAction}>
              <button
                type="submit"
                aria-label="Doel verwijderen"
                title="Doel verwijderen"
                className="text-muted-foreground hover:text-terracotta transition-colors"
                onClick={e => { if (!confirm('Actief doel verwijderen?')) e.preventDefault() }}
              >
                <Trash2 size={14} />
              </button>
            </form>
          </div>
        </div>
        <p className="mt-2 text-foreground font-medium">{goal.name}</p>
        <p className="mb-3 text-xs text-muted-foreground">{GOAL_TYPE_LABELS[goal.goalType]}</p>

        {progress ? (
          <ProgressBar
            value={progress.percentage}
            tone="sage"
            subtext={
              goal.goalType === 'passive_income_coverage'
                ? `${formatPercent(progress.currentValue)} van 100% dekkingsgraad`
                : `${formatCurrency(progress.currentValue)} van ${formatCurrency(progress.targetValue)}`
            }
          />
        ) : (
          <p className="text-sm text-muted-foreground">Onvoldoende data om voortgang te tonen.</p>
        )}

        {goal.targetDate && (
          <p className="mt-2 text-xs text-muted-foreground">Streefdatum: {formatDate(goal.targetDate)}</p>
        )}

        {projection && (
          <p className="mt-2 text-xs text-muted-foreground">
            Verwacht op {formatDate(projection.date)} bij {formatPercent(projection.ratePct / 100)} rendement op
            aandelen/ETF&apos;s: <span className="font-medium text-foreground">{formatCurrency(projection.value)}</span> — overig
            vermogen aangenomen gelijk
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="bg-card border border-border rounded-3xl p-6">
      <p className="mb-3 text-sm font-medium text-muted-foreground">Actief doel</p>

      {state?.error && (
        <div className="mb-3 rounded-lg border border-terracotta/30 bg-terracotta/10 p-3 text-sm text-terracotta">
          {state.error}
        </div>
      )}

      <form action={formAction} className="space-y-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="goal-name">Naam</Label>
          <input
            id="goal-name"
            name="name"
            type="text"
            defaultValue={goal?.name ?? ''}
            placeholder="Bijv. Noodfonds, FI-nummer, Aanbetaling huis"
            required
            className="h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="goal-type">Type</Label>
          <select
            id="goal-type"
            name="goalType"
            value={goalType}
            onChange={e => setGoalType(e.target.value as GoalType)}
            className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm transition-colors"
          >
            <option value="net_worth">Vermogensdoel — t.o.v. netto vermogen</option>
            <option value="savings">Spaardoel — t.o.v. je spaargeld</option>
            <option value="passive_income_coverage">FI-dekkingsgraad — passief inkomen dekt 100% vaste lasten</option>
          </select>
        </div>

        {goalType !== 'passive_income_coverage' && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="goal-target">Doelbedrag (€)</Label>
            <input
              id="goal-target"
              name="targetAmount"
              type="number"
              step="0.01"
              min="0"
              defaultValue={goal?.targetAmount ?? ''}
              placeholder="50000"
              required
              className="h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="goal-date">Streefdatum (optioneel)</Label>
          <input
            id="goal-date"
            name="targetDate"
            type="date"
            defaultValue={goal?.targetDate ?? ''}
            className="h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button
            type="submit"
            disabled={isPending}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isPending ? 'Opslaan…' : 'Opslaan'}
          </button>
          {goal && (
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Annuleren
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
