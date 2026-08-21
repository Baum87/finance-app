'use client'

import { useActionState, useState, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getStockQuoteAction, getHistoricalPriceEurAction } from '@/app/portfolio/_archief-aandelen-etf/market-actions'
import { formatCurrency, formatQuantity } from '@/lib/utils/format'
import type { ActionState } from '@/app/assets/actions'

const today = new Date().toISOString().slice(0, 10)

type Props = {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>
  assetId: string
  ticker: string
  quantityHeld: number
  wac: number | null
  redirectTo?: string
  cancelHref?: string
}

export function SellTransactionForm({ action, assetId, ticker, quantityHeld, wac, redirectTo, cancelHref }: Props) {
  const [state, formAction, isPending] = useActionState(action, null)

  const [date, setDate] = useState(today)
  const [pricePerUnit, setPricePerUnit] = useState('')
  const [quantity, setQuantity] = useState('')
  const [isFetching, setIsFetching] = useState(true)
  const [notes, setNotes] = useState('')
  const dateTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const priceNum = parseFloat(pricePerUnit.replace(',', '.')) || 0
  const qtyNum = parseFloat(quantity.replace(',', '.')) || 0
  const totalProceeds = priceNum > 0 && qtyNum > 0 ? priceNum * qtyNum : 0
  const costBasis = wac && qtyNum > 0 ? wac * qtyNum : null
  const realizedGain = costBasis !== null && totalProceeds > 0 ? totalProceeds - costBasis : null
  const remainingQty = quantityHeld - qtyNum
  const overSelling = qtyNum > quantityHeld

  async function fetchPrice(forDate: string) {
    setIsFetching(true)
    try {
      if (forDate === today) {
        const quote = await getStockQuoteAction(ticker)
        if (quote) setPricePerUnit(quote.priceEur.toFixed(4))
      } else {
        const price = await getHistoricalPriceEurAction(ticker, forDate)
        if (price) setPricePerUnit(price.toFixed(4))
      }
    } finally {
      setIsFetching(false)
    }
  }

  useEffect(() => { fetchPrice(today) }, [])

  function handleDateChange(val: string) {
    setDate(val)
    clearTimeout(dateTimerRef.current)
    dateTimerRef.current = setTimeout(() => fetchPrice(val), 400)
  }

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="assetId" value={assetId} />
      <input type="hidden" name="transactionType" value="sell" />
      <input type="hidden" name="currency" value="EUR" />
      <input type="hidden" name="fxRate" value="1" />
      <input type="hidden" name="amount" value={totalProceeds > 0 ? totalProceeds.toFixed(2) : ''} />
      {redirectTo && <input type="hidden" name="redirectTo" value={redirectTo} />}

      {state?.error && (
        <div className="rounded-lg border border-terracotta/30 bg-terracotta/10 p-3 text-sm text-terracotta">
          {state.error}
        </div>
      )}

      {/* Huidig bezit */}
      <div className="rounded-lg bg-muted/50 px-4 py-3 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Huidig bezit</span>
        <span className="font-medium text-foreground">{formatQuantity(quantityHeld)} stuks</span>
      </div>

      <div className="grid grid-cols-2 gap-4">

        {/* Datum */}
        <div className="col-span-2 flex flex-col gap-1.5">
          <Label htmlFor="sellDate">
            Verkoopdatum<span className="text-terracotta ml-0.5">*</span>
          </Label>
          <Input
            id="sellDate"
            name="transactionDate"
            type="date"
            value={date}
            max={today}
            onChange={e => handleDateChange(e.target.value)}
          />
        </div>

        {/* Verkoopkoers */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pricePerUnit">
            Koers per stuk (EUR)
            {isFetching && <span className="ml-2 text-xs font-normal text-muted-foreground">Ophalen…</span>}
            <span className="text-terracotta ml-0.5">*</span>
          </Label>
          <Input
            id="pricePerUnit"
            name="pricePerUnit"
            inputMode="decimal"
            placeholder="0.00"
            value={pricePerUnit}
            onChange={e => setPricePerUnit(e.target.value)}
          />
        </div>

        {/* Aantal */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="quantity">
            Aantal te verkopen<span className="text-terracotta ml-0.5">*</span>
          </Label>
          <Input
            id="quantity"
            name="quantity"
            inputMode="decimal"
            placeholder={String(quantityHeld)}
            value={quantity}
            onChange={e => setQuantity(e.target.value)}
            className={overSelling ? 'border-terracotta focus-visible:ring-terracotta' : ''}
          />
          {overSelling && (
            <p className="text-xs text-terracotta">
              Je hebt maar {formatQuantity(quantityHeld)} stuks in bezit.
            </p>
          )}
        </div>

        {/* Samenvatting */}
        {totalProceeds > 0 && !overSelling && (
          <div className="col-span-2 rounded-lg border border-border bg-muted/30 divide-y divide-border overflow-hidden text-sm">
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-muted-foreground">Totale opbrengst</span>
              <span className="font-semibold text-foreground">{formatCurrency(totalProceeds)}</span>
            </div>
            {costBasis !== null && (
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-muted-foreground">Kostprijs ({formatQuantity(qtyNum)} × {formatCurrency(wac!)})</span>
                <span className="text-muted-foreground">{formatCurrency(costBasis)}</span>
              </div>
            )}
            {realizedGain !== null && (
              <div className="flex items-center justify-between px-4 py-2.5 font-medium">
                <span className="text-muted-foreground">Gerealiseerde winst</span>
                <span className={realizedGain >= 0 ? 'text-sage' : 'text-terracotta'}>
                  {realizedGain >= 0 ? '+' : ''}{formatCurrency(realizedGain)}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between px-4 py-2.5 text-muted-foreground">
              <span>Resterend bezit</span>
              <span>{formatQuantity(remainingQty)} stuks</span>
            </div>
          </div>
        )}

        {/* Notitie */}
        <div className="col-span-2 flex flex-col gap-1.5">
          <Label htmlFor="notes">Notitie</Label>
          <Input
            id="notes"
            name="notes"
            placeholder="bijv. Gedeeltelijke verkoop"
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={isPending || totalProceeds <= 0 || overSelling}
          className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {isPending ? 'Opslaan…' : 'Verkoop opslaan'}
        </button>
        <a href={cancelHref} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          Annuleren
        </a>
      </div>
    </form>
  )
}
