'use client'

import { useState, useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { CHART_COLORS, CHART_STYLE } from '@/lib/utils/chart-colors'

type DataPoint = { date: string; value: number }

type Filter = '1M' | '6M' | '1J' | 'Alles'

const FILTERS: Filter[] = ['1M', '6M', '1J', 'Alles']

function filterDays(filter: Filter): number {
  switch (filter) {
    case '1M':    return 30
    case '6M':    return 180
    case '1J':    return 365
    case 'Alles': return Infinity
  }
}

function formatXAxis(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('nl-NL', { month: 'short', year: '2-digit' })
}

function formatYAxis(value: number): string {
  if (value >= 1_000_000) return `€${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000)     return `€${Math.round(value / 1_000)}k`
  return `€${Math.round(value)}`
}

interface NetWorthChartProps {
  data: DataPoint[]
}

export function NetWorthChart({ data }: NetWorthChartProps) {
  const [filter, setFilter] = useState<Filter>('Alles')

  const filtered = useMemo(() => {
    const days = filterDays(filter)
    if (days === Infinity) return data
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)
    const cutoffStr = cutoff.toISOString().slice(0, 10)
    return data.filter(d => d.date >= cutoffStr)
  }, [data, filter])

  if (data.length === 0) {
    return (
      <div className="bg-card border border-border rounded-3xl p-6 h-[280px] flex items-center justify-center">
        <p className="text-sm text-muted-foreground italic">
          Voeg waarderingen toe aan je assets om het verloop te zien.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-card border border-border rounded-3xl p-6">
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm font-medium text-foreground">Vermogensontwikkeling</p>
        <div className="flex items-center gap-1">
          {FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={[
                'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                filter === f
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              ].join(' ')}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={filtered} margin={{ top: 4, right: 4, bottom: 4, left: 8 }}>
          <CartesianGrid vertical={false} stroke={CHART_STYLE.gridStroke} strokeDasharray="0" />
          <XAxis
            dataKey="date"
            tickFormatter={formatXAxis}
            tick={{ fill: CHART_STYLE.axisTickFill, fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={formatYAxis}
            tick={{ fill: CHART_STYLE.axisTickFill, fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={60}
          />
          <Tooltip
            formatter={(v) =>
              typeof v === 'number'
                ? new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v)
                : String(v)
            }
            labelFormatter={(label) => typeof label === 'string' ? formatXAxis(label) : String(label)}
            contentStyle={CHART_STYLE.tooltipContent}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={CHART_COLORS.sage}
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 4, fill: CHART_COLORS.sage }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
