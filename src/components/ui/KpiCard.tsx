interface KpiCardProps {
  label: string
  value: string
  subtext?: string
  trend?: { value: string; positive: boolean }
  /** Voor gebruik binnen een andere `bg-card`-kaart — voorkomt dat de tegel
   * visueel wegvalt tegen de omringende kaart (zelfde achtergrondkleur). */
  nested?: boolean
}

export function KpiCard({ label, value, subtext, trend, nested }: KpiCardProps) {
  return (
    <div className={`border border-border rounded-3xl p-6 ${nested ? 'bg-background' : 'bg-card'}`}>
      <p className="text-sm text-muted-foreground font-medium">{label}</p>
      <p className="text-3xl font-semibold text-foreground mt-1">{value}</p>
      {trend?.value && (
        <p className={`mt-1 text-sm font-medium ${trend.positive ? 'text-sage' : 'text-terracotta'}`}>
          {trend.value}
        </p>
      )}
      {subtext && (
        <p className="mt-1 text-xs text-muted-foreground">{subtext}</p>
      )}
    </div>
  )
}
