'use client'

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import { CHART_COLORS, CHART_STYLE } from '@/lib/utils/chart-colors'

export type SingleLineDataPoint = { month: string; value: number }

function formatEur(value: number) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value)
}

function monthLabel(key: string) {
  const [year, month] = key.split('-')
  return new Date(Number(year), Number(month) - 1).toLocaleDateString('nl-NL', { month: 'short', year: '2-digit' })
}

type Props = { data: SingleLineDataPoint[]; title?: string; valueLabel?: string }

export function SingleLineChart({ data, title = 'Verloop', valueLabel = 'Vermogen' }: Props) {
  if (data.length === 0) {
    return (
      <div className="bg-card border border-border rounded-2xl p-6 flex items-center justify-center h-48">
        <p className="text-sm text-muted-foreground">Nog geen invoer om te tonen.</p>
      </div>
    )
  }

  const chartData = data.map(({ month, value }) => ({ month: monthLabel(month), value }))

  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <p className="text-sm text-muted-foreground mb-4">{title}</p>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
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
          <Tooltip
            formatter={value => [formatEur(Number(value)), valueLabel]}
            contentStyle={CHART_STYLE.tooltipContent}
            labelStyle={{ fontSize: 11, color: CHART_STYLE.labelFill }}
          />
          <Line dataKey="value" stroke={CHART_COLORS.sage} strokeWidth={1.5} dot={false} activeDot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
