'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { formatCurrency, formatPercent } from '@/lib/utils/format'
import type { AllocationSlice } from '@/lib/finance'

const ASSET_TYPE_LABELS: Record<string, string> = {
  stock_etf:   'Aandelen & ETF',
  crypto:      'Crypto',
  savings:     'Sparen',
  real_estate: 'Vastgoed',
  pension:     'Pensioen',
}

const COLORS = ['#6E8F74', '#7B92B2', '#D4A05D', '#C97A6B']

interface AllocationChartProps {
  slices: AllocationSlice[]
}

type Segment = {
  name: string
  value: number
  percentage: number
}

function buildSegments(slices: AllocationSlice[]): Segment[] {
  const reSegments: Segment[] = []
  const others: Segment[] = []

  const total = slices.reduce((s, sl) => s + sl.value.toNumber(), 0)
  if (total === 0) return []

  for (const sl of slices) {
    const pct = sl.percentage.toNumber()
    const seg: Segment = {
      name: ASSET_TYPE_LABELS[sl.assetType] ?? sl.assetType,
      value: sl.value.toNumber(),
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
      <tspan x={cx} y={cy - 10} fontSize={12} fill="#6B7280">{largest.name}</tspan>
      <tspan x={cx} y={cy + 10} fontSize={16} fontWeight={600} fill="#161616">
        {formatPercent(largest.percentage / 100)}
      </tspan>
    </text>
  )
}

export function AllocationChart({ slices }: AllocationChartProps) {
  const segments = buildSegments(slices)

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
      <p className="text-sm text-muted-foreground mb-4">Allocatie</p>
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
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
            <CenterLabel largest={largest} />
          </Pie>
          <Tooltip
            formatter={(value, name) => [
              `${formatCurrency(value as number)} (${formatPercent((segments.find(s => s.name === name)?.percentage ?? 0) / 100)})`,
              name,
            ]}
            contentStyle={{ background: '#fff', borderRadius: '12px', border: '1px solid #ECEAE5' }}
          />
        </PieChart>
      </ResponsiveContainer>

    </div>
  )
}
