'use client'

import { useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { formatCurrency, formatPercent } from '@/lib/utils/format'
import { CHART_PALETTE, CHART_STYLE } from '@/lib/utils/chart-colors'

// Plain numbers, niet Decimal — dit is een Client Component en Decimal-instanties
// kunnen niet over de server/client-grens geserialiseerd worden.
export type AllocationSliceInput = {
  assetType: string
  value: number
  percentage: number
}

const ASSET_TYPE_LABELS: Record<string, string> = {
  stock_etf:   'Aandelen & ETF',
  crypto:      'Crypto',
  savings:     'Sparen',
  real_estate: 'Vastgoed',
  pension:     'Pensioen',
  vordering:   'Vorderingen',
}

interface AllocationChartProps {
  slices: AllocationSliceInput[]
  // Alleen aandelen/crypto/spaargeld — laat beleggingskeuzes zien zonder dat
  // een grote vastgoed- of pensioenpositie de grafiek domineert (§1c). Als
  // deze leeg is (of gelijk aan `slices`) wordt geen toggle getoond.
  liquidSlices?: AllocationSliceInput[]
}

type Segment = {
  name: string
  value: number
  percentage: number
}

function buildSegments(slices: AllocationSliceInput[]): Segment[] {
  const reSegments: Segment[] = []
  const others: Segment[] = []

  const total = slices.reduce((s, sl) => s + sl.value, 0)
  if (total === 0) return []

  for (const sl of slices) {
    const pct = sl.percentage
    const seg: Segment = {
      name: ASSET_TYPE_LABELS[sl.assetType] ?? sl.assetType,
      value: sl.value,
      percentage: pct,
    }
    if ((sl.assetType === 'real_estate' || sl.assetType === 'pension') && pct < 5) {
      others.push(seg)
    } else {
      reSegments.push(seg)
    }
  }

  if (others.length > 0) {
    const combinedValue = others.reduce((s, o) => s + o.value, 0)
    const combinedPct = others.reduce((s, o) => s + o.percentage, 0)
    reSegments.push({ name: 'Vastgoed & Pensioen', value: combinedValue, percentage: combinedPct })
  }

  return reSegments.sort((a, b) => b.value - a.value)
}

interface CenterLabelProps {
  cx?: number
  cy?: number
  largest: Segment | undefined
}

function CenterLabel({ cx = 0, cy = 0, largest }: CenterLabelProps) {
  if (!largest) return null
  return (
    <text textAnchor="middle" dominantBaseline="central">
      <tspan x={cx} y={cy - 10} fontSize={12} fill={CHART_STYLE.labelFill}>{largest.name}</tspan>
      <tspan x={cx} y={cy + 10} fontSize={16} fontWeight={600} fill={CHART_STYLE.valueFill}>
        {formatPercent(largest.percentage / 100)}
      </tspan>
    </text>
  )
}

export function AllocationChart({ slices, liquidSlices }: AllocationChartProps) {
  const [view, setView] = useState<'total' | 'liquid'>('total')
  const showToggle = !!liquidSlices && liquidSlices.length > 0 && liquidSlices.length !== slices.length
  const activeSlices = showToggle && view === 'liquid' ? liquidSlices! : slices
  const segments = buildSegments(activeSlices)

  if (segments.length === 0) {
    return (
      <div className="bg-card border border-border rounded-3xl p-6 text-center">
        <p className="text-sm text-muted-foreground mb-2">Allocatie</p>
        <p className="text-sm text-muted-foreground italic">Voeg assets toe om de allocatie te zien.</p>
      </div>
    )
  }

  const largest = segments[0]

  return (
    <div className="bg-card border border-border rounded-3xl p-6">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">Allocatie</p>
        {showToggle && (
          <div className="flex gap-1 p-0.5 bg-muted rounded-lg">
            <button
              type="button"
              onClick={() => setView('total')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                view === 'total' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Totaal
            </button>
            <button
              type="button"
              onClick={() => setView('liquid')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                view === 'liquid' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Liquide
            </button>
          </div>
        )}
      </div>
      {showToggle && view === 'liquid' && (
        <p className="text-xs text-muted-foreground -mt-2 mb-4">Alleen aandelen, crypto en spaargeld — vastgoed en pensioen buiten beschouwing.</p>
      )}
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={segments}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            dataKey="value"
            paddingAngle={2}
          >
            {segments.map((_, i) => (
              <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />
            ))}
            <CenterLabel largest={largest} />
          </Pie>
          <Tooltip
            formatter={(value, name) => [
              `${formatCurrency(value as number)} (${formatPercent((segments.find(s => s.name === name)?.percentage ?? 0) / 100)})`,
              name,
            ]}
            contentStyle={CHART_STYLE.tooltipContent}
          />
        </PieChart>
      </ResponsiveContainer>

    </div>
  )
}
