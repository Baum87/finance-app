'use client'

import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import { CHART_COLORS, CHART_STYLE } from '@/lib/utils/chart-colors'

export type MonthlyCashflowDataPoint = { month: string; income: number; expenses: number; net: number }

function formatEur(value: number) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value)
}

function monthLabel(key: string) {
  const [year, month] = key.split('-')
  return new Date(Number(year), Number(month) - 1).toLocaleDateString('nl-NL', { month: 'short', year: '2-digit' })
}

const TOOLTIP_LABELS: Record<string, string> = {
  income:   'Inkomen',
  expenses: 'Uitgaven',
  net:      'Netto',
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

// Netto-lijn blijft neutraal zolang de maand een overschot heeft — terracotta
// is bewust gereserveerd voor tekort-maanden (designsysteem), niet voor de
// lijn als geheel.
function NetDot({ cx, cy, payload }: { cx?: number; cy?: number; payload?: { net: number } }) {
  if (cx === undefined || cy === undefined || !payload) return null
  const negative = payload.net < 0
  return <circle cx={cx} cy={cy} r={3} fill={negative ? CHART_COLORS.terracotta : CHART_STYLE.valueFill} />
}

type Props = { data: MonthlyCashflowDataPoint[] }

export function MonthlyCashflowChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="bg-card border border-border rounded-2xl p-6 flex items-center justify-center h-48">
        <p className="text-sm text-muted-foreground">Nog geen vaste lasten/inkomsten om een trend te tonen.</p>
      </div>
    )
  }

  const chartData = data.map(({ month, income, expenses, net }) => ({
    month: monthLabel(month),
    income,
    expenses,
    net,
  }))

  const hasDeficitMonth = data.some(p => p.net < 0)

  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <p className="text-sm text-muted-foreground mb-4">Inkomen vs. uitgaven — laatste 12 maanden</p>
      <ResponsiveContainer width="100%" height={260}>
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
          <Bar dataKey="income" fill={CHART_COLORS.sage} radius={[3, 3, 0, 0]} isAnimationActive={false} />
          <Bar dataKey="expenses" fill={CHART_COLORS.steel} radius={[3, 3, 0, 0]} isAnimationActive={false} />
          <Line dataKey="net" stroke={CHART_STYLE.valueFill} strokeWidth={1.5} dot={<NetDot />} activeDot={{ r: 4 }} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: CHART_COLORS.sage }} />
          Inkomen
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: CHART_COLORS.steel }} />
          Uitgaven
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: CHART_STYLE.valueFill }} />
          Netto
        </span>
        {hasDeficitMonth && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: CHART_COLORS.terracotta }} />
            Tekort-maand
          </span>
        )}
      </div>
    </div>
  )
}
