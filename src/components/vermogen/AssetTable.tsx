import Link from 'next/link'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { formatCurrency, formatPercent } from '@/lib/utils/format'
import type Decimal from 'decimal.js'

const ASSET_TYPE_LABELS: Record<string, string> = {
  stock_etf: 'Aandeel / ETF',
  crypto:    'Crypto',
  savings:   'Spaarrekening',
}

export type AssetRow = {
  id: string
  name: string
  assetType: string
  currentValue: Decimal
  netDeposit: Decimal
  unrealizedGain: Decimal
  xirr: Decimal | null
}

interface AssetTableProps {
  assets: AssetRow[]
}

export function AssetTable({ assets }: AssetTableProps) {
  if (assets.length === 0) {
    return (
      <div className="bg-card border border-border rounded-3xl p-6 text-center">
        <p className="text-sm text-muted-foreground">Geen liquide assets gevonden.</p>
        <Link href="/assets/new" className="mt-3 inline-block text-sm font-medium text-sage hover:opacity-70 transition-opacity">
          Voeg een asset toe →
        </Link>
      </div>
    )
  }

  const sorted = [...assets].sort((a, b) => b.currentValue.minus(a.currentValue).toNumber())

  return (
    <div className="bg-card border border-border rounded-3xl overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Naam</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="text-right">Huidige waarde</TableHead>
            <TableHead className="text-right">Ingelegd</TableHead>
            <TableHead className="text-right">XIRR</TableHead>
            <TableHead className="text-right">+/−</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((asset) => {
            const gainPositive = asset.unrealizedGain.gte(0)
            return (
              <TableRow key={asset.id}>
                <TableCell className="font-medium">
                  <Link href={`/assets/${asset.id}`} className="hover:text-primary transition-colors">
                    {asset.name}
                  </Link>
                </TableCell>
                <TableCell>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                    {ASSET_TYPE_LABELS[asset.assetType] ?? asset.assetType}
                  </span>
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(asset.currentValue.toNumber())}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {formatCurrency(asset.netDeposit.toNumber())}
                </TableCell>
                <TableCell className="text-right">
                  {asset.xirr
                    ? <span className={asset.xirr.gt(0) ? 'text-sage' : 'text-terracotta'}>{formatPercent(asset.xirr.toNumber())}</span>
                    : <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="text-right">
                  <span className={gainPositive ? 'text-sage' : 'text-terracotta'}>
                    {gainPositive ? '+' : ''}{formatCurrency(asset.unrealizedGain.toNumber())}
                  </span>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
