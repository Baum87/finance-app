'use client'

import Link from 'next/link'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { deleteAssetAction } from '@/app/assets/actions'
type AssetRow = {
  id: string
  name: string
  assetType: string
  currency: string
  currentValue: number
}

const ASSET_TYPE_LABELS: Record<string, string> = {
  stock_etf:    'Aandeel / ETF',
  crypto:       'Crypto',
  savings:      'Spaarrekening',
  real_estate:  'Vastgoed',
  pension:      'Pensioen',
}

function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency }).format(value)
}

export function AssetList({ assets }: { assets: AssetRow[] }) {
  if (assets.length === 0) {
    return (
      <div className="rounded-3xl border border-border bg-card p-12 flex flex-col items-center gap-4">
        <p className="text-sm text-muted-foreground">Nog geen assets toegevoegd.</p>
        <Link
          href="/assets/new"
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Voeg je eerste asset toe
        </Link>
      </div>
    )
  }

  return (
    <div className="rounded-3xl border border-border bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Naam</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Valuta</TableHead>
            <TableHead className="text-right">Huidige waarde</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {assets.map((asset) => (
            <TableRow key={asset.id}>
              <TableCell className="font-medium text-foreground">
                <Link href={`/assets/${asset.id}`} className="hover:text-primary transition-colors">
                  {asset.name}
                </Link>
              </TableCell>
              <TableCell>
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                  {ASSET_TYPE_LABELS[asset.assetType] ?? asset.assetType}
                </span>
              </TableCell>
              <TableCell className="text-muted-foreground">{asset.currency}</TableCell>
              <TableCell className="text-right font-medium">
                {asset.currentValue > 0
                  ? formatCurrency(asset.currentValue, asset.currency)
                  : '—'}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <Link
                    href={`/assets/${asset.id}/edit`}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Bewerken
                  </Link>
                  <form action={deleteAssetAction}>
                    <input type="hidden" name="assetId" value={asset.id} />
                    <button
                      type="submit"
                      className="text-xs text-terracotta hover:opacity-70 transition-opacity"
                      onClick={(e) => {
                        if (!confirm(`${asset.name} verwijderen?`)) e.preventDefault()
                      }}
                    >
                      Verwijderen
                    </button>
                  </form>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
