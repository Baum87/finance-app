import Link from 'next/link'
import { formatCurrency } from '@/lib/utils/format'

type Props = {
  href: string
  name: string
  subtitle: string
  value: number
  badge?: string
  footer?: { label: string; value: string }
}

export function PortfolioTile({ href, name, subtitle, value, badge, footer }: Props) {
  return (
    <Link
      href={href}
      className="block bg-card border border-border rounded-2xl p-6 hover:border-primary/40 transition-colors group"
    >
      <div className="mb-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors leading-tight">
            {name}
          </p>
          {badge && (
            <span className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
              {badge}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
      </div>

      <p className="text-2xl font-semibold text-foreground tabular-nums">
        {formatCurrency(value)}
      </p>

      {footer && (
        <div className="mt-4 pt-4 border-t border-border flex items-center gap-1">
          <span className="text-xs text-muted-foreground">{footer.label}</span>
          <span className="text-xs font-medium text-sage ml-1">{footer.value}</span>
        </div>
      )}
    </Link>
  )
}
