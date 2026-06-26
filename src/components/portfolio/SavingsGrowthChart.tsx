'use client'

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import { CHART_COLORS, CHART_STYLE } from '@/lib/utils/chart-colors'
import type { SavingsDataPoint } from '@/lib/finance/savings-series'

function formatEur(value: number) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value)
}

type Props = { data: SavingsDataPoint[] }

export function SavingsGrowthChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="bg-card border border-border rounded-2xl p-6 flex items-center justify-center h-48">
        <p className="text-sm text-muted-foreground">Nog geen transacties om te tonen.</p>
      </div>
    )
  }

  const hasInterest = data.some(d => d.balance > d.deposits)

  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <p className="text-sm text-muted-foreground mb-4">Groei spaarrekeningen</p>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
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
            formatter={(value, name) => [
              formatEur(Number(value)),
              name === 'balance' ? 'Werkelijk saldo' : 'Eigen inleg',
            ]}
            contentStyle={CHART_STYLE.tooltipContent}
            labelStyle={{ fontSize: 11, color: CHART_STYLE.labelFill }}
          />
          <Line
            dataKey="balance"
            stroke={CHART_COLORS.sage}
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 4 }}
          />
          {hasInterest && (
            <Line
              dataKey="deposits"
              stroke={CHART_COLORS.sand}
              strokeWidth={1.5}
              strokeDasharray="4 3"
              dot={false}
              activeDot={{ r: 4 }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
