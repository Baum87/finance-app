import Link from 'next/link'
import { formatPercent } from '@/lib/utils/format'

type Props = {
  hasInvestmentAssumption: boolean
  /** null = onvoldoende data, of het doel wordt bij deze rendementen nooit bereikt. 0 = al bereikt. */
  years: number | null
  stockRatePct: number | null
  realEstateRatePct: number | null
}

function rateSummary(stockRatePct: number | null, realEstateRatePct: number | null): string {
  if (stockRatePct == null) return 'dit rendement'
  const stockPart = `${formatPercent(stockRatePct / 100)} op aandelen/ETF's`
  return realEstateRatePct != null
    ? `${stockPart} en ${formatPercent(realEstateRatePct / 100)} op vastgoed`
    : stockPart
}

export function TimeToGoalCard({ hasInvestmentAssumption, years, stockRatePct, realEstateRatePct }: Props) {
  const goalReached = years === 0
  return (
    <div className="bg-card border border-border rounded-3xl p-6">
      <p className="text-sm font-medium text-muted-foreground">Tijd tot doel</p>

      {!hasInvestmentAssumption ? (
        <>
          <p className="mt-2 text-2xl font-semibold text-foreground">—</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Stel een verwacht rendement in bij{' '}
            <Link href="/portfolio/aandelen-etf" className="underline hover:opacity-70">
              Aandelen &amp; ETF&apos;s
            </Link>{' '}
            om deze projectie te zien.
          </p>
        </>
      ) : goalReached ? (
        <>
          <p className="mt-2 text-2xl font-semibold text-sage">Al bereikt</p>
          <p className="mt-2 text-xs text-muted-foreground">Je huidige vermogen is al op of boven je doelbedrag.</p>
        </>
      ) : years != null ? (
        <>
          <p className="mt-2 text-2xl font-semibold text-foreground">{years.toFixed(1)} jaar</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Bij {rateSummary(stockRatePct, realEstateRatePct)}, rente op rente vanaf nu — verwacht rond{' '}
            {new Date().getFullYear() + Math.ceil(years)}.
          </p>
        </>
      ) : (
        <>
          <p className="mt-2 text-2xl font-semibold text-foreground">—</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Onvoldoende data, of het doel wordt bij {rateSummary(stockRatePct, realEstateRatePct)} nooit via
            rendement alleen bereikt.
          </p>
        </>
      )}
    </div>
  )
}
