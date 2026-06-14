'use client'

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { CHART_COLORS, CHART_STYLE } from '@/lib/utils/chart-colors'
import type { PortfolioDataPoint } from '@/lib/finance/portfolio-series'

function formatEur(value: number) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value)
}

type Props = { data: PortfolioDataPoint[]; title?: string }

export function PortfolioInlegChart({ data, title = 'Cumulatieve inleg' }: Props) {
  if (data.length === 0) {
    return (
      <div className="bg-card border border-border rounded-2xl p-6 flex items-center justify-center h-48">
        <p className="text-sm text-muted-foreground">Nog geen transacties om te tonen.</p>
      </div>
    )
  }

  const hasWaarde = data.some(d => d.waarde !== undefined)

  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <p className="text-sm text-muted-foreground mb-4">{title}</p>
      <ResponsiveContainer width="100%" height={240}>
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
              name === 'inleg' ? 'Cumulatieve inleg' : 'Marktwaarde',
            ]}
            contentStyle={CHART_STYLE.tooltipContent}
            labelStyle={{ fontSize: 11, color: CHART_STYLE.labelFill }}
          />
          {hasWaarde && (
            <Legend
              formatter={name => name === 'inleg' ? 'Cumulatieve inleg' : 'Marktwaarde'}
              wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
            />
          )}
          <Line
            dataKey="inleg"
            stroke={CHART_COLORS.steel}
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 4 }}
          />
          {hasWaarde && (
            <Line
              dataKey="waarde"
              stroke={CHART_COLORS.sage}
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 4 }}
              connectNulls={false}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
