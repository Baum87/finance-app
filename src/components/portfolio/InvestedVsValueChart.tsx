'use client'

import { useState } from 'react'
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import { CHART_COLORS, CHART_STYLE } from '@/lib/utils/chart-colors'

export type ChartDataPoint = { month: string; invested: number; currentValue: number }

type ViewMode = 'month' | 'year'

function formatEur(value: number) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value)
}

function monthLabel(key: string) {
  const [year, month] = key.split('-')
  return new Date(Number(year), Number(month) - 1).toLocaleDateString('nl-NL', { month: 'short', year: '2-digit' })
}

/** Eén punt per jaar: de laatste (dus meest recente) maandwaarde van dat jaar. */
function toYearlyPoints(data: ChartDataPoint[]): ChartDataPoint[] {
  const byYear = new Map<string, ChartDataPoint>()
  for (const point of data) {
    byYear.set(point.month.slice(0, 4), point)
  }
  return [...byYear.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([year, point]) => ({ ...point, month: year }))
}

const TOOLTIP_LABELS: Record<string, string> = {
  invested: 'Ingelegd',
  currentValue: 'Huidige waarde',
}

function ChartTooltip({ active, payload, label }: {
  active?: boolean
  payload?: { dataKey?: string | number; value?: number }[]
  label?: string
}) {
  if (!active || !payload) return null
  const rows = payload.filter(p => typeof p.dataKey === 'string' && p.dataKey in TOOLTIP_LABELS)
  if (rows.length === 0) return null
  return (
    <div style={CHART_STYLE.tooltipContent} className="px-3 py-2">
      <p style={{ fontSize: 11, color: CHART_STYLE.labelFill }} className="mb-1">{label}</p>
      {rows.map(r => (
        <p key={String(r.dataKey)} style={{ fontSize: 12, color: CHART_STYLE.valueFill }}>
          {TOOLTIP_LABELS[r.dataKey as string]}: {formatEur(r.value ?? 0)}
        </p>
      ))}
    </div>
  )
}

type Props = { data: ChartDataPoint[] }

export function InvestedVsValueChart({ data }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>('month')

  if (data.length === 0) {
    return (
      <div className="bg-card border border-border rounded-2xl p-6 flex items-center justify-center h-48">
        <p className="text-sm text-muted-foreground">Nog geen invoer om te tonen.</p>
      </div>
    )
  }

  const sourceData = viewMode === 'year' ? toYearlyPoints(data) : data

  const chartData = sourceData.map(({ month, invested, currentValue }) => ({
    month: viewMode === 'year' ? month : monthLabel(month),
    invested,
    currentValue,
    base: Math.min(invested, currentValue),
    gain: currentValue > invested ? currentValue - invested : 0,
    loss: invested > currentValue ? invested - currentValue : 0,
  }))

  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <p className="text-sm text-muted-foreground">Ingelegd vs. huidige waarde</p>
        <div className="flex items-center gap-1 rounded-lg bg-muted/50 p-0.5">
          <button
            type="button"
            onClick={() => setViewMode('month')}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              viewMode === 'month' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Maand
          </button>
          <button
            type="button"
            onClick={() => setViewMode('year')}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              viewMode === 'year' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Jaar
          </button>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
          <CartesianGrid vertical={false} stroke={CHART_STYLE.gridStroke} />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11, fill: CHART_STYLE.axisTickFill }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={v => formatEur(v)}
            tick={{ fontSize: 11, fill: CHART_STYLE.axisTickFill }}
            axisLine={false}
            tickLine={false}
            width={72}
          />
          <Tooltip content={<ChartTooltip />} />
          {/* Gebied onder de laagste lijn: neutraal, iets donkerder */}
          <Area dataKey="base" stackId="1" stroke="none" fill={CHART_COLORS.steel} fillOpacity={0.18} isAnimationActive={false} />
          {/* Gebied tussen de lijnen: groen bij winst, rood bij verlies */}
          <Area dataKey="gain" stackId="1" stroke="none" fill={CHART_COLORS.sage} fillOpacity={0.28} isAnimationActive={false} />
          <Area dataKey="loss" stackId="1" stroke="none" fill={CHART_COLORS.terracotta} fillOpacity={0.28} isAnimationActive={false} />
          <Line dataKey="invested" stroke={CHART_COLORS.steel} strokeWidth={1.5} dot={false} activeDot={{ r: 4 }} />
          <Line dataKey="currentValue" stroke={CHART_COLORS.sage} strokeWidth={1.5} dot={false} activeDot={{ r: 4 }} />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: CHART_COLORS.steel }} />
          Ingelegd
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: CHART_COLORS.sage }} />
          Huidige waarde
        </span>
      </div>
    </div>
  )
}
