import { formatCurrency, formatPercent, formatDate } from '@/lib/utils/format'
import { KpiCard } from '@/components/ui/KpiCard'
import type { SimpleEntrySectionMetrics } from '@/lib/finance'

type Props = {
  title: string
  metrics: SimpleEntrySectionMetrics
}

function signed(value: number): string {
  return `${value >= 0 ? '+' : ''}${formatCurrency(value)}`
}

function contributionSubtext(contribution: number, suffix: string): string {
  if (contribution === 0) return `Geen extra inleg ${suffix}`
  const verb = contribution > 0 ? 'ingelegd' : 'onttrokken'
  return `${formatCurrency(Math.abs(contribution))} ${verb} ${suffix}`
}

export function SimpleEntrySection({ title, metrics }: Props) {
  const { invested, currentValue, gain, gainPct, ytd, sinceLastUpdate } = metrics

  return (
    <div className="bg-card border border-border rounded-3xl p-6 space-y-4">
      <p className="text-sm font-medium text-muted-foreground">{title}</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <KpiCard
          nested
          label="Winst dit jaar"
          value={ytd != null ? signed(ytd.gain.toNumber()) : '—'}
          subtext={ytd != null ? contributionSubtext(ytd.contribution.toNumber(), 'dit jaar') : 'Onvoldoende data van vóór dit jaar'}
          trend={ytd?.gainPct != null
            ? { value: `${formatPercent(ytd.gainPct.toNumber())} dit jaar`, positive: ytd.gainPct.gte(0) }
            : undefined}
        />
        <KpiCard
          nested
          label="Winst sinds laatste update"
          value={sinceLastUpdate != null ? signed(sinceLastUpdate.gain.toNumber()) : '—'}
          subtext={sinceLastUpdate != null
            ? contributionSubtext(sinceLastUpdate.contribution.toNumber(), `sinds ${formatDate(sinceLastUpdate.date)}`)
            : 'Nog maar 1 invoermoment'}
          trend={sinceLastUpdate?.gainPct != null
            ? { value: `${formatPercent(sinceLastUpdate.gainPct.toNumber())} sinds vorige update`, positive: sinceLastUpdate.gainPct.gte(0) }
            : undefined}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard nested label="Totaal ingelegd" value={formatCurrency(invested.toNumber())} />
        <KpiCard nested label="Totaal huidige waarde" value={formatCurrency(currentValue.toNumber())} />
        <KpiCard
          nested
          label="Winst / verlies"
          value={signed(gain.toNumber())}
          trend={gainPct != null ? { value: formatPercent(gainPct.toNumber()), positive: gainPct.gte(0) } : undefined}
        />
      </div>
    </div>
  )
}
