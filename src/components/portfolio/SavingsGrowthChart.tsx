'use client'

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
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
              name === 'balance' ? 'Werkelijk saldo' : 'Cumulatieve inleg',
            ]}
            contentStyle={CHART_STYLE.tooltipContent}
            labelStyle={{ fontSize: 11, color: CHART_STYLE.labelFill }}
          />
          <Legend
            formatter={name => name === 'balance' ? 'Werkelijk saldo' : 'Cumulatieve inleg'}
            iconType="plainline"
            wrapperStyle={{ fontSize: 12 }}
          />
          <Line
            dataKey="balance"
            stroke={CHART_COLORS.sage}
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            dataKey="deposits"
            stroke={CHART_COLORS.steel}
            strokeWidth={1.5}
            dot={false}
            strokeDasharray="4 3"
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
      <p className="text-xs text-muted-foreground mt-3">
        De ruimte tussen de lijnen is het rendement op rente.
      </p>
    </div>
  )
}
