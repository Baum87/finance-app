'use client'

import { useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ReferenceLine, ResponsiveContainer,
} from 'recharts'
import { CHART_COLORS, CHART_STYLE } from '@/lib/utils/chart-colors'
import { formatPercent } from '@/lib/utils/format'
import type { PortfolioDataPoint } from '@/lib/finance/portfolio-series'

function formatEur(value: number) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value)
}

type RangeKey = '1y' | '5y' | 'all'

const RANGE_OPTIONS: { key: RangeKey; label: string; months: number | null }[] = [
  { key: '1y',  label: '1 jaar',    months: 12 },
  { key: '5y',  label: '5 jaar',    months: 60 },
  { key: 'all', label: 'Alles',     months: null },
]

type Mode = 'eur' | 'pct'

type Props = { data: PortfolioDataPoint[]; title?: string }

export function PortfolioInlegChart({ data, title = 'Cumulatieve inleg' }: Props) {
  const [range, setRange] = useState<RangeKey>('all')
  const [mode, setMode] = useState<Mode>('eur')

  if (data.length === 0) {
    return (
      <div className="bg-card border border-border rounded-2xl p-6 flex items-center justify-center h-48">
        <p className="text-sm text-muted-foreground">Nog geen transacties om te tonen.</p>
      </div>
    )
  }

  const activeMonths = RANGE_OPTIONS.find(o => o.key === range)?.months ?? null
  const visibleData = activeMonths ? data.slice(-activeMonths) : data

  const hasWaarde = visibleData.some(d => d.waarde !== undefined)
  const hasPartial = visibleData.some(d => d.partial)

  // Cumulatief rendement t.o.v. inleg: (waarde − inleg) / inleg per maand.
  const pctData = visibleData.map(d => ({
    month: d.month,
    rendement: d.waarde !== undefined && d.inleg > 0 ? (d.waarde - d.inleg) / d.inleg : null,
  }))

  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <p className="text-sm text-muted-foreground">{title}</p>
        <div className="flex items-center gap-2">
          {hasWaarde && (
            <div className="flex items-center gap-1 rounded-lg bg-muted/50 p-0.5">
              <button
                type="button"
                onClick={() => setMode('eur')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  mode === 'eur' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                €
              </button>
              <button
                type="button"
                onClick={() => setMode('pct')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  mode === 'pct' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                %
              </button>
            </div>
          )}
          <div className="flex items-center gap-1 rounded-lg bg-muted/50 p-0.5">
            {RANGE_OPTIONS.map(o => (
              <button
                key={o.key}
                type="button"
                onClick={() => setRange(o.key)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  range === o.key
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {mode === 'eur' ? (
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={visibleData} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
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
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={pctData} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
            <CartesianGrid vertical={false} stroke={CHART_STYLE.gridStroke} />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fill: CHART_STYLE.axisTickFill }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={v => formatPercent(v)}
              tick={{ fontSize: 11, fill: CHART_STYLE.axisTickFill }}
              axisLine={false}
              tickLine={false}
              width={56}
            />
            <ReferenceLine y={0} stroke={CHART_STYLE.axisTickFill} strokeWidth={1} />
            <Tooltip
              formatter={value => [formatPercent(Number(value)), 'Rendement t.o.v. inleg']}
              contentStyle={CHART_STYLE.tooltipContent}
              labelStyle={{ fontSize: 11, color: CHART_STYLE.labelFill }}
            />
            <Line
              dataKey="rendement"
              stroke={CHART_COLORS.sage}
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 4 }}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      )}

      {mode === 'pct' && (
        <p className="text-xs text-muted-foreground mt-3">
          Cumulatief rendement: (marktwaarde − inleg) ÷ inleg, per maand.
        </p>
      )}
      {hasPartial && (
        <p className="text-xs text-muted-foreground mt-3">
          Voor sommige maanden ontbreekt live koersdata van 1 of meer posities (bijv. een
          niet-beursgenoteerd instrument) — daarvoor is de kostprijs gebruikt als benadering.
        </p>
      )}
    </div>
  )
}
