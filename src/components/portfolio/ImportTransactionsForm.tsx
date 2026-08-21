'use client'

import { useActionState, useState } from 'react'
import Decimal from 'decimal.js'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatCurrency } from '@/lib/utils/format'
import {
  parseImportAction, confirmImportAction,
  type ImportPreviewState, type ConfirmImportInput, type ConfirmImportResult,
} from '@/app/portfolio/_archief-aandelen-etf/broker/[id]/import/actions'

type Props = {
  brokerId: string
  backTo: string
}

function groupTotal(rows: { amount: string; transactionType: string }[]): Decimal {
  return rows.reduce(
    (sum, r) => sum.plus(r.transactionType === 'sell' ? new Decimal(r.amount) : new Decimal(r.amount).negated()),
    new Decimal(0),
  )
}

export function ImportTransactionsForm({ brokerId, backTo }: Props) {
  const [state, formAction, isParsing] = useActionState<ImportPreviewState, FormData>(parseImportAction, null)
  const [result, setResult] = useState<ConfirmImportResult | null>(null)
  const [isConfirming, setIsConfirming] = useState(false)

  const preview = state && !('error' in state) ? state : null

  async function handleConfirm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!preview) return
    setIsConfirming(true)
    const fd = new FormData(e.currentTarget)

    const payload: ConfirmImportInput = {
      brokerId,
      existing: preview.existing.map(g => ({ assetId: g.assetId, rows: g.rows })),
      newPositions: preview.newPositions.map(g => ({
        isin: g.isin,
        product: g.product,
        ticker: String(fd.get(`ticker-${g.isin}`) ?? ''),
        sector: String(fd.get(`sector-${g.isin}`) ?? '') || null,
        rows: g.rows,
      })),
    }

    const res = await confirmImportAction(payload)
    setResult(res)
    setIsConfirming(false)
  }

  if (result && !('error' in result)) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center space-y-4">
        <p className="text-sm font-medium text-foreground">Import voltooid</p>
        <div className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
          <span><span className="font-semibold text-foreground">{result.inserted}</span> transacties geïmporteerd</span>
          {result.duplicates > 0 && <span><span className="font-semibold text-foreground">{result.duplicates}</span> duplicaten overgeslagen</span>}
          {result.createdPositions > 0 && <span><span className="font-semibold text-foreground">{result.createdPositions}</span> nieuwe posities aangemaakt</span>}
          {result.skippedPositions > 0 && <span><span className="font-semibold text-foreground">{result.skippedPositions}</span> posities overgeslagen (geen ticker)</span>}
        </div>
        <a href={backTo} className="inline-block px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
          Terug naar broker
        </a>
      </div>
    )
  }

  if (!preview) {
    return (
      <form action={formAction} className="rounded-2xl border border-border bg-card p-8 space-y-4">
        <input type="hidden" name="brokerId" value={brokerId} />

        {state && 'error' in state && (
          <div className="rounded-lg border border-terracotta/30 bg-terracotta/10 p-3 text-sm text-terracotta">
            {state.error}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="file">Transactiebestand (.xlsx)</Label>
          <input
            id="file"
            name="file"
            type="file"
            accept=".xlsx"
            required
            className="text-sm text-foreground file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border file:border-input file:bg-transparent file:text-sm file:font-medium"
          />
          <p className="text-xs text-muted-foreground">
            Op dit moment ondersteund: Degiro-transactie-export.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={isParsing}
            className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isParsing ? 'Bestand lezen…' : 'Bestand inlezen'}
          </button>
          <a href={backTo} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Annuleren
          </a>
        </div>
      </form>
    )
  }

  const totalRows = preview.existing.reduce((n, g) => n + g.rows.length, 0)
    + preview.newPositions.reduce((n, g) => n + g.rows.length, 0)

  return (
    <form onSubmit={handleConfirm} className="space-y-6">
      {result && 'error' in result && (
        <div className="rounded-lg border border-terracotta/30 bg-terracotta/10 p-3 text-sm text-terracotta">
          {result.error}
        </div>
      )}

      {preview.warnings.length > 0 && (
        <details className="rounded-xl border border-border bg-muted/30 p-4">
          <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
            {preview.warnings.length} rij{preview.warnings.length !== 1 ? 'en' : ''} overgeslagen bij het lezen
          </summary>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            {preview.warnings.map((w, i) => <li key={i}>Rij {w.row}: {w.message}</li>)}
          </ul>
        </details>
      )}

      {preview.existing.length > 0 && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <p className="text-sm font-semibold text-foreground">Bestaande posities</p>
            <p className="text-xs text-muted-foreground mt-0.5">Worden gekoppeld op ISIN — geen nieuwe positie nodig.</p>
          </div>
          <div className="divide-y divide-border">
            {preview.existing.map(g => (
              <div key={g.isin} className="px-6 py-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-xs font-mono font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                    {g.ticker}
                  </span>
                  <span className="text-sm font-medium text-foreground truncate">{g.assetName}</span>
                </div>
                <span className="text-sm text-muted-foreground shrink-0">
                  {g.rows.length} transactie{g.rows.length !== 1 ? 's' : ''} · {formatCurrency(groupTotal(g.rows).toNumber())}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {preview.newPositions.length > 0 && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <p className="text-sm font-semibold text-foreground">Nieuwe posities</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Onbekend ISIN — het bestand levert geen ticker. Controleer de suggestie of vul zelf aan.
              Laat het tickerveld leeg om deze positie (en de bijbehorende transacties) over te slaan.
            </p>
          </div>
          <div className="divide-y divide-border">
            {preview.newPositions.map(g => (
              <div key={g.isin} className="px-6 py-4 grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-3 items-end">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{g.product}</p>
                  <p className="text-xs text-muted-foreground">
                    ISIN {g.isin} · {g.rows.length} transactie{g.rows.length !== 1 ? 's' : ''} · {formatCurrency(groupTotal(g.rows).toNumber())}
                  </p>
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor={`ticker-${g.isin}`} className="text-xs">Ticker</Label>
                  <Input
                    id={`ticker-${g.isin}`}
                    name={`ticker-${g.isin}`}
                    defaultValue={g.suggestedTicker ?? ''}
                    placeholder="bv. AAPL"
                    className="w-32"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor={`sector-${g.isin}`} className="text-xs">Sector</Label>
                  <Input
                    id={`sector-${g.isin}`}
                    name={`sector-${g.isin}`}
                    defaultValue={g.suggestedSector ?? ''}
                    placeholder="optioneel"
                    className="w-40"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isConfirming}
          className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {isConfirming ? 'Importeren…' : `${totalRows} transactie${totalRows !== 1 ? 's' : ''} bevestigen en importeren`}
        </button>
        <a href={backTo} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          Annuleren
        </a>
      </div>
    </form>
  )
}
