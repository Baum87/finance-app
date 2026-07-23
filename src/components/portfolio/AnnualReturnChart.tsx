'use client'

import { useState } from 'react'
import {
  ComposedChart, Bar, Line, Cell, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, LabelList, Legend, Tooltip,
} from 'recharts'
import { CHART_COLORS, CHART_STYLE } from '@/lib/utils/chart-colors'
import { formatCurrency, formatPercent } from '@/lib/utils/format'

export type AnnualReturnPoint = {
  year: number
  returnAmount: number
  returnPct: number | null
  /** Koersrendement van de benchmark (IWDA — MSCI World) in hetzelfde kalenderjaar. */
  benchmarkPct?: number | null
}

type Mode = 'amount' | 'pct'

export function AnnualReturnChart({ data }: { data: AnnualReturnPoint[] }) {
  const [mode, setMode] = useState<Mode>('amount')

  const hasAnyPct = data.some(d => d.returnPct !== null)
  const hasBenchmark = data.some(d => d.benchmarkPct !== null && d.benchmarkPct !== undefined)

  const chartData = data.map(d => ({
    year: String(d.year),
    value: mode === 'amount' ? d.returnAmount : (d.returnPct ?? null),
    benchmark: mode === 'pct' ? (d.benchmarkPct ?? null) : null,
  }))

  const fmt = (v: number) => mode === 'amount' ? formatCurrency(v) : formatPercent(v)

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
        <ComposedChart data={chartData} margin={{ top: 16, right: 8, bottom: 0, left: 8 }}>
          <CartesianGrid vertical={false} stroke={CHART_STYLE.gridStroke} />
          <XAxis
            dataKey="year"
            tick={{ fontSize: 11, fill: CHART_STYLE.axisTickFill }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={v => fmt(v)}
            tick={{ fontSize: 11, fill: CHART_STYLE.axisTickFill }}
            axisLine={false}
            tickLine={false}
            width={mode === 'amount' ? 72 : 52}
          />
          <Tooltip
            cursor={{ fill: 'transparent' }}
            formatter={(value, name) => [
              value === null || value === undefined ? '—' : fmt(Number(value)),
              name === 'benchmark' ? 'Benchmark (IWDA — MSCI World)' : 'Portefeuille',
            ]}
            contentStyle={CHART_STYLE.tooltipContent}
            labelStyle={{ fontSize: 11, color: CHART_STYLE.labelFill }}
          />
          {mode === 'pct' && hasBenchmark && (
            <Legend
              formatter={name => name === 'benchmark' ? 'Benchmark (IWDA — MSCI World)' : 'Portefeuille'}
              wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
            />
          )}
          <Bar dataKey="value" radius={[4, 4, 4, 4]} maxBarSize={56}>
            {chartData.map((d) => (
              <Cell
                key={d.year}
                fill={d.value === null ? CHART_STYLE.gridStroke : (d.value >= 0 ? CHART_COLORS.sage : CHART_COLORS.terracotta)}
              />
            ))}
            {(mode === 'amount' || !hasBenchmark) && (
              <LabelList
                dataKey="value"
                position="top"
                formatter={(v: string | number | boolean | null | undefined) =>
                  v === null || v === undefined ? '—' : fmt(Number(v))}
                style={{ fontSize: 11, fill: CHART_STYLE.labelFill }}
              />
            )}
          </Bar>
          {mode === 'pct' && hasBenchmark && (
            <Line
              dataKey="benchmark"
              stroke={CHART_COLORS.steel}
              strokeWidth={2}
              dot={{ r: 3, fill: CHART_COLORS.steel }}
              activeDot={{ r: 5 }}
              connectNulls
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>

      {mode === 'pct' && (
        <p className="mt-2 text-xs text-muted-foreground">
          Percentage = Time-Weighted Return (maandelijks gekoppeld), net als de benchmark — dus
          ongevoelig voor wannéér je hebt ingelegd. Voor je échte, geld-gewogen rendement (inclusief
          timing) kijk je naar de XIRR elders in de app. Het €-bedrag hierboven is altijd
          timing-onafhankelijk correct.
        </p>
      )}
      {data.some(d => d.returnPct === null) && (
        <p className="mt-2 text-xs text-muted-foreground">
          Voor het allereerste jaar is nog geen percentage te tonen (er is dan nog geen vorige
          maandwaarde om het rendement tegen af te zetten). Het €-bedrag klopt wel altijd.
        </p>
      )}
    </div>
  )
}
