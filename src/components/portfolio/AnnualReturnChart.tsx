'use client'

import { useState } from 'react'
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, LabelList,
} from 'recharts'
import { CHART_COLORS, CHART_STYLE } from '@/lib/utils/chart-colors'
import { formatCurrency, formatPercent } from '@/lib/utils/format'

export type AnnualReturnPoint = {
  year: number
  returnAmount: number
  returnPct: number | null
}

type Mode = 'amount' | 'pct'

export function AnnualReturnChart({ data }: { data: AnnualReturnPoint[] }) {
  const [mode, setMode] = useState<Mode>('amount')

  const hasAnyPct = data.some(d => d.returnPct !== null)

  const chartData = data.map(d => ({
    year: String(d.year),
    value: mode === 'amount' ? d.returnAmount : (d.returnPct ?? null),
  }))

  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">Rendement per kalenderjaar</p>
        <div className="flex items-center gap-1 rounded-lg bg-muted/50 p-0.5">
          <button
            type="button"
            onClick={() => setMode('amount')}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${mode === 'amount' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            €
          </button>
          <button
            type="button"
            onClick={() => setMode('pct')}
            disabled={!hasAnyPct}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${mode === 'pct' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            %
          </button>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} margin={{ top: 16, right: 8, bottom: 0, left: 8 }}>
          <CartesianGrid vertical={false} stroke={CHART_STYLE.gridStroke} />
          <XAxis
            dataKey="year"
            tick={{ fontSize: 11, fill: CHART_STYLE.axisTickFill }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={v => mode === 'amount' ? formatCurrency(v) : formatPercent(v)}
            tick={{ fontSize: 11, fill: CHART_STYLE.axisTickFill }}
            axisLine={false}
            tickLine={false}
            width={mode === 'amount' ? 72 : 52}
          />
          <Bar dataKey="value" radius={[4, 4, 4, 4]} maxBarSize={56}>
            {chartData.map((d) => (
              <Cell
                key={d.year}
                fill={d.value === null ? CHART_STYLE.gridStroke : (d.value >= 0 ? CHART_COLORS.sage : CHART_COLORS.terracotta)}
              />
            ))}
            <LabelList
              dataKey="value"
              position="top"
              formatter={(v: string | number | boolean | null | undefined) =>
                v === null || v === undefined ? '—' : (mode === 'amount' ? formatCurrency(Number(v)) : formatPercent(Number(v)))}
              style={{ fontSize: 11, fill: CHART_STYLE.labelFill }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {data.some(d => d.returnPct === null) && (
        <p className="mt-2 text-xs text-muted-foreground">
          Voor het eerste jaar is geen percentage te tonen — de portefeuille begon dat jaar bij €0.
        </p>
      )}
    </div>
  )
}
