'use client'

import { useActionState, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ActionState } from '@/app/assets/actions'
import type { Transaction } from '@/lib/db/queries/transactions'

type TransactionType =
  | 'buy' | 'sell' | 'deposit' | 'withdrawal'
  | 'dividend' | 'interest' | 'rental_income' | 'cost'

const ALL_TX_OPTIONS: { value: TransactionType; label: string }[] = [
  { value: 'buy',           label: 'Aankoop' },
  { value: 'sell',          label: 'Verkoop' },
  { value: 'deposit',       label: 'Storting' },
  { value: 'withdrawal',    label: 'Opname' },
  { value: 'dividend',      label: 'Dividend' },
  { value: 'interest',      label: 'Rente' },
  { value: 'rental_income', label: 'Huurinkomst' },
  { value: 'cost',          label: 'Kosten' },
]

const WITH_QUANTITY: TransactionType[] = ['buy', 'sell']
// Alleen assettypes met een "aantal stuks"-concept (aandelen, crypto) tonen
// aantal/koers bij aankoop/verkoop. Bij vastgoed is "aankoop" een lump-sum
// eigen-inbreng-bedrag, geen aantal × koers.
const QUANTITY_ASSET_TYPES = new Set(['stock_etf', 'crypto'])

// Bij vastgoed betekent "Aankoop" niet "een aandeel kopen" maar: je eigen
// inbreng vastleggen (aankoopprijs + kosten min hypotheek) — zonder deze
// transactie mist Totaalrendement (XIRR) zijn startpunt en overschat het
// rendement enorm (lijkt alsof je met €0 inleg bent begonnen).
const TYPE_LABEL_OVERRIDES: Partial<Record<string, Partial<Record<TransactionType, string>>>> = {
  real_estate: {
    buy:  'Eigen inbreng (bij aankoop)',
    sell: 'Verkoopopbrengst',
  },
}

type Props = {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>
  assetId: string
  assetType?: string
  transactionId?: string
  initialData?: Transaction
  redirectTo?: string
  cancelHref?: string
  allowedTypes?: TransactionType[]
}

export function TransactionForm({ action, assetId, assetType, transactionId, initialData, redirectTo, cancelHref, allowedTypes }: Props) {
  const [state, formAction, isPending] = useActionState(action, null)

  const options = (allowedTypes ? ALL_TX_OPTIONS.filter(o => allowedTypes.includes(o.value)) : ALL_TX_OPTIONS)
    .map(o => ({ ...o, label: (assetType && TYPE_LABEL_OVERRIDES[assetType]?.[o.value]) ?? o.label }))

  const defaultType = (initialData?.transactionType as TransactionType)
    ?? options[0]?.value
    ?? 'buy'

  const [txType, setTxType] = useState<TransactionType>(defaultType)
  const [repeat, setRepeat] = useState(false)

  const showQuantity = WITH_QUANTITY.includes(txType) && (!assetType || QUANTITY_ASSET_TYPES.has(assetType))
  const today = new Date().toISOString().slice(0, 10)

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="assetId" value={assetId} />
      <input type="hidden" name="currency" value="EUR" />
      <input type="hidden" name="fxRate" value="1" />
      {transactionId && <input type="hidden" name="transactionId" value={transactionId} />}
      {redirectTo && <input type="hidden" name="redirectTo" value={redirectTo} />}

      {state?.error && (
        <div className="rounded-lg border border-terracotta/30 bg-terracotta/10 p-3 text-sm text-terracotta">
          {state.error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {/* Type */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="transactionType">Type<span className="text-terracotta ml-0.5">*</span></Label>
          <select
            name="transactionType"
            id="transactionType"
            value={txType}
            onChange={e => setTxType(e.target.value as TransactionType)}
            className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm transition-colors"
          >
            {options.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Datum */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="transactionDate">Datum<span className="text-terracotta ml-0.5">*</span></Label>
          <Input
            id="transactionDate"
            name="transactionDate"
            type="date"
            defaultValue={initialData?.transactionDate ?? today}
          />
        </div>

        {/* Bedrag */}
        <div className={`flex flex-col gap-1.5 ${showQuantity ? '' : 'col-span-2'}`}>
          <Label htmlFor="amount">Bedrag<span className="text-terracotta ml-0.5">*</span></Label>
          <Input
            id="amount"
            name="amount"
            type="text"
            inputMode="decimal"
            defaultValue={initialData?.amount}
            placeholder="1250.00"
          />
          {txType === 'dividend' && (
            <p className="text-xs text-muted-foreground">Voer het netto ontvangen bedrag in (na ingehouden dividendbelasting).</p>
          )}
          {assetType === 'real_estate' && txType === 'buy' && (
            <p className="text-xs text-muted-foreground">
              Je eigen inbreng bij aankoop (aankoopprijs + kosten min hypotheek) — nodig om Totaalrendement
              (XIRR) correct te berekenen. Zonder deze transactie lijkt het alsof je zonder inleg bent gestart.
            </p>
          )}
          {assetType === 'real_estate' && txType === 'sell' && (
            <p className="text-xs text-muted-foreground">De verkoopopbrengst van het pand.</p>
          )}
          {txType !== 'dividend' && !(assetType === 'real_estate' && (txType === 'buy' || txType === 'sell')) && (
            <p className="text-xs text-muted-foreground">Voer het bedrag in euro's in. Andere valuta? Reken eerst om naar euro's.</p>
          )}
        </div>

        {/* Aantal + koers — alleen bij buy/sell */}
        {showQuantity && (
          <>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="quantity">Aantal</Label>
              <Input
                id="quantity"
                name="quantity"
                type="text"
                inputMode="decimal"
                defaultValue={initialData?.quantity ?? ''}
                placeholder="10.5"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pricePerUnit">Koers per stuk (EUR)</Label>
              <Input
                id="pricePerUnit"
                name="pricePerUnit"
                type="text"
                inputMode="decimal"
                defaultValue={initialData?.pricePerUnit ?? ''}
                placeholder="119.05"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fees">Transactiekosten (€)</Label>
              <Input
                id="fees"
                name="fees"
                type="text"
                inputMode="decimal"
                defaultValue={initialData?.fees ?? ''}
                placeholder="0.00"
              />
              <p className="text-xs text-muted-foreground">Commissie, spread of andere kosten</p>
            </div>
          </>
        )}

        {/* Notitie */}
        <div className="col-span-2 flex flex-col gap-1.5">
          <Label htmlFor="notes">Notitie</Label>
          <Input
            id="notes"
            name="notes"
            type="text"
            defaultValue={initialData?.notes ?? ''}
            placeholder="bijv. Q2 dividend uitkering"
          />
        </div>

        {/* Herhalen — alleen bij een nieuwe transactie, niet bij bewerken */}
        {!transactionId && (
          <div className="col-span-2 space-y-3 rounded-lg border border-border p-4">
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                name="repeat"
                onChange={e => setRepeat(e.target.checked)}
                className="rounded border-border text-sage focus:ring-1 focus:ring-primary"
              />
              Herhaal deze transactie automatisch
            </label>
            {repeat && (
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="repeatFrequency">Frequentie</Label>
                  <select
                    name="repeatFrequency"
                    id="repeatFrequency"
                    defaultValue="monthly"
                    className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm transition-colors"
                  >
                    <option value="monthly">Maandelijks</option>
                    <option value="four_weekly">Per 4 weken</option>
                    <option value="quarterly">Per kwartaal</option>
                    <option value="yearly">Jaarlijks</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="repeatCount">Aantal keer (incl. deze)</Label>
                  <Input id="repeatCount" name="repeatCount" type="number" min="1" max="60" defaultValue="12" />
                </div>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Maakt losse transacties aan (bedrag en type gelijk, datum loopt op) die je daarna
              individueel kunt bewerken of verwijderen — geen doorlopende regel.
            </p>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {isPending ? 'Opslaan…' : 'Opslaan'}
        </button>
        <a href={cancelHref ?? `/assets/${assetId}`} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          Annuleren
        </a>
      </div>
    </form>
  )
}
