interface ProgressBarProps {
  value: number
  label?: string
  subtext?: string
}

export function ProgressBar({ value, label, subtext }: ProgressBarProps) {
  const pct = Math.min(Math.max(value, 0), 1) * 100

  return (
    <div>
      {label && (
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-sm font-medium text-foreground">
            {new Intl.NumberFormat('nl-NL', { style: 'percent', maximumFractionDigits: 1 }).format(value)}
          </p>
        </div>
      )}
      <div className="h-1.5 w-full rounded-full bg-border overflow-hidden">
        <div
          className="h-full rounded-full bg-muted-foreground transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      {subtext && <p className="mt-1.5 text-xs text-muted-foreground">{subtext}</p>}
    </div>
  )
}
