'use client'

import { useActionState, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ActionState } from '@/app/assets/actions'
import type { Transaction } from '@/lib/db/queries/transactions'

type TransactionType =
  | 'buy' | 'sell' | 'deposit' | 'withdrawal'
  | 'dividend' | 'interest' | 'rental_income' | 'cost'

const TX_OPTIONS: { value: TransactionType; label: string }[] = [
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

type Props = {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>
  assetId: string
  transactionId?: string
  initialData?: Transaction
  redirectTo?: string
  cancelHref?: string
}

export function TransactionForm({ action, assetId, transactionId, initialData, redirectTo, cancelHref }: Props) {
  const [state, formAction, isPending] = useActionState(action, null)
  const [txType, setTxType] = useState<TransactionType>(
    (initialData?.transactionType as TransactionType) ?? 'buy'
  )

  const showQuantity = WITH_QUANTITY.includes(txType)

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="assetId" value={assetId} />
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
            {TX_OPTIONS.map(o => (
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
            defaultValue={initialData?.transactionDate ?? new Date().toISOString().slice(0, 10)}
          />
        </div>

        {/* Bedrag */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="amount">Bedrag (€)<span className="text-terracotta ml-0.5">*</span></Label>
          <Input
            id="amount"
            name="amount"
            type="text"
            inputMode="decimal"
            defaultValue={initialData?.amount}
            placeholder="1250.00"
          />
        </div>

        {/* Valuta */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="currency">Valuta</Label>
          <select name="currency" id="currency" defaultValue={initialData?.currency ?? 'EUR'}
            className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm transition-colors">
            <option value="EUR">EUR</option>
            <option value="USD">USD</option>
            <option value="GBP">GBP</option>
          </select>
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
              <Label htmlFor="pricePerUnit">Koers per stuk (€)</Label>
              <Input
                id="pricePerUnit"
                name="pricePerUnit"
                type="text"
                inputMode="decimal"
                defaultValue={initialData?.pricePerUnit ?? ''}
                placeholder="119.05"
              />
            </div>
          </>
        )}

        {/* Wisselkoers (alleen tonen als niet EUR) */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fxRate">Wisselkoers</Label>
          <Input
            id="fxRate"
            name="fxRate"
            type="text"
            inputMode="decimal"
            defaultValue={initialData?.fxRate ?? '1'}
            placeholder="1"
          />
        </div>

        {/* Notitie */}
        <div className="col-span-2 flex flex-col gap-1.5">
          <Label htmlFor="notes">Notitie</Label>
          <Input
            id="notes"
            name="notes"
            type="text"
            defaultValue={initialData?.notes ?? ''}
            placeholder="Maandelijkse inleg"
          />
        </div>
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
