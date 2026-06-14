'use client'

import { useActionState, useState, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getStockQuoteAction, getHistoricalPriceEurAction } from '@/app/portfolio/aandelen-etf/market-actions'
import type { ActionState } from '@/app/assets/actions'

const today = new Date().toISOString().slice(0, 10)

const fmt = (v: number) =>
  v.toLocaleString('nl-NL', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 })

type Props = {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>
  assetId: string
  ticker: string
  redirectTo?: string
  cancelHref?: string
}

export function BuyTransactionForm({ action, assetId, ticker, redirectTo, cancelHref }: Props) {
  const [state, formAction, isPending] = useActionState(action, null)

  const [date, setDate] = useState(today)
  const [pricePerUnit, setPricePerUnit] = useState('')
  const [quantity, setQuantity] = useState('')
  const [isFetching, setIsFetching] = useState(true)
  const [notes, setNotes] = useState('')
  const dateTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const totalAmount = pricePerUnit && quantity
    ? (parseFloat(pricePerUnit.replace(',', '.')) * parseFloat(quantity.replace(',', '.'))) || 0
    : 0

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
      <input type="hidden" name="transactionType" value="buy" />
      <input type="hidden" name="currency" value="EUR" />
      <input type="hidden" name="fxRate" value="1" />
      <input type="hidden" name="amount" value={totalAmount > 0 ? totalAmount.toFixed(2) : ''} />
      {redirectTo && <input type="hidden" name="redirectTo" value={redirectTo} />}

      {state?.error && (
        <div className="rounded-lg border border-terracotta/30 bg-terracotta/10 p-3 text-sm text-terracotta">
          {state.error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">

        {/* Datum */}
        <div className="col-span-2 flex flex-col gap-1.5">
          <Label htmlFor="purchaseDate">
            Aankoopdatum<span className="text-terracotta ml-0.5">*</span>
          </Label>
          <Input
            id="purchaseDate"
            name="transactionDate"
            type="date"
            value={date}
            max={today}
            onChange={e => handleDateChange(e.target.value)}
          />
          {date !== today && (
            <p className="text-xs text-muted-foreground">
              Historische koers voor {new Date(date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })} wordt opgehaald.
            </p>
          )}
        </div>

        {/* Koers per stuk */}
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
            Aantal<span className="text-terracotta ml-0.5">*</span>
          </Label>
          <Input
            id="quantity"
            name="quantity"
            inputMode="decimal"
            placeholder="10"
            value={quantity}
            onChange={e => setQuantity(e.target.value)}
          />
        </div>

        {/* Totaal preview */}
        {totalAmount > 0 && (
          <div className="col-span-2 rounded-lg bg-muted/50 px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Totale aankoopwaarde</span>
            <span className="text-sm font-semibold text-foreground">{fmt(totalAmount)}</span>
          </div>
        )}

        {/* Notitie */}
        <div className="col-span-2 flex flex-col gap-1.5">
          <Label htmlFor="notes">Notitie</Label>
          <Input
            id="notes"
            name="notes"
            placeholder="bijv. Maandelijkse inleg januari"
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={isPending || totalAmount <= 0}
          className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {isPending ? 'Opslaan…' : 'Aankoop opslaan'}
        </button>
        <a href={cancelHref} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          Annuleren
        </a>
      </div>
    </form>
  )
}
