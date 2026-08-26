'use server'

import { redirect } from 'next/navigation'
import { isRedirectError } from 'next/dist/client/components/redirect-error'
import { z } from 'zod'
import { requireUser } from '@/lib/db/supabase-server'
import {
  createAsset, updateAsset, deleteAsset, getAsset,
} from '@/lib/db/queries/assets'
import type { TransactionType, AssetType } from '@/types'
import {
  createTransaction, updateTransaction, deleteTransaction,
} from '@/lib/db/queries/transactions'
import { createValuation, updateValuation, deleteValuation } from '@/lib/db/queries/valuations'
import { createMortgageBalance, updateMortgageBalance, deleteMortgageBalance } from '@/lib/db/queries/mortgage-balances'
import { createWozValue, updateWozValue, deleteWozValue } from '@/lib/db/queries/woz-values'
import { createRecurringCashflow, updateRecurringCashflow, deleteRecurringCashflow } from '@/lib/db/queries/recurring-cashflows'
import { revalidatePath } from 'next/cache'
import type { AssetDetailsInput } from '@/lib/db/queries/assets'
import Decimal from 'decimal.js'
import { getLatestPrice } from '@/lib/services/prices'

export type ActionState = { error: string } | null

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const baseSchema = z.object({
  name:      z.string().min(1, 'Naam is verplicht'),
  assetType: z.enum(['stock_etf', 'crypto', 'savings', 'real_estate', 'pension', 'vordering']),
  currency:  z.string().default('EUR'),
})

const positiveAmount = (label: string) =>
  z.string()
    .min(1, `${label} is verplicht`)
    .refine(v => !Number.isNaN(Number(v)) && Number(v) >= 0, { message: `${label} moet een positief getal zijn` })

const optionalPositiveAmount = (label: string) =>
  z.string()
    .refine(v => !Number.isNaN(Number(v)) && Number(v) >= 0, { message: `${label} moet een positief getal zijn` })
    .optional()

const stockEtfSchema = z.object({
  ticker:         z.string().min(1, 'Ticker is verplicht'),
  isin:           z.string().optional(),
  brokerId:       z.string().optional(),
  accountType:    z.string().optional(),
  sector:         z.string().optional(),
  instrumentType: z.string().optional(),
})

const cryptoSchema = z.object({
  ticker:           z.string().min(1, 'Symbol is verplicht'),
  walletOrExchange: z.string().optional(),
})

const savingsSchema = z.object({
  bankName:         z.string().min(1, 'Bank is verplicht'),
  savingsAccountType: z.string().optional(),
  interestRate:     optionalPositiveAmount('Rente'),
})

const pensionSchema = z.object({
  provider:               z.string().min(1, 'Aanbieder is verplicht'),
  pensionType:            z.string().min(1, 'Type is verplicht'),
  projectedAnnualBenefit: optionalPositiveAmount('Verwachte jaarlijkse uitkering'),
})

const vorderingSchema = z.object({
  counterparty:    z.string().min(1, 'Naam schuldenaar is verplicht'),
  principalAmount: positiveAmount('Geleend bedrag'),
  interestRate:    optionalPositiveAmount('Rente'),
  startDate:       z.string().optional(),
  endDate:         z.string().optional(),
  loanType:        z.string().optional(),
})

const realEstateSchema = z.object({
  street:        z.string().min(1, 'Straat en huisnummer is verplicht'),
  postalCode:    z.string().optional(),
  city:          z.string().min(1, 'Plaats is verplicht'),
  propertyType:  z.enum(['rental', 'primary_residence', 'vacation']),
  purchasePrice: positiveAmount('Aankoopprijs'),
  purchaseCosts: positiveAmount('Aankoopkosten'),
  purchaseDate:  z.string().min(1, 'Aankoopdatum is verplicht'),
  wozValue:      optionalPositiveAmount('WOZ-waarde'),
  // hypotheek (optioneel, alleen bij rental)
  mortgageLender:         z.string().optional(),
  mortgageOriginalAmount: optionalPositiveAmount('Hypotheekbedrag'),
  mortgageInterestRate:   optionalPositiveAmount('Hypotheekrente'),
  mortgageStartDate:      z.string().optional(),
  mortgageEndDate:        z.string().optional(),
  mortgageType:           z.string().optional(),
})

const ALLOWED_TX_TYPES: Record<AssetType, TransactionType[]> = {
  stock_etf:   ['buy', 'sell', 'dividend', 'cost'],
  crypto:      ['buy', 'sell', 'deposit'],
  savings:     ['deposit', 'withdrawal', 'interest'],
  real_estate: ['buy', 'sell', 'rental_income', 'cost'],
  pension:     ['deposit'],
  vordering:   ['deposit', 'withdrawal', 'interest'],
}

const transactionSchema = z.object({
  transactionType: z.enum(['buy', 'sell', 'deposit', 'withdrawal', 'dividend', 'interest', 'rental_income', 'cost']),
  amount:          positiveAmount('Bedrag'),
  quantity:        optionalPositiveAmount('Aantal'),
  pricePerUnit:    optionalPositiveAmount('Prijs per stuk'),
  transactionDate: z.string().min(1, 'Datum is verplicht'),
  currency:        z.string().default('EUR'),
  fxRate:          z.string().default('1'),
  notes:           z.string().optional(),
  fees:            optionalPositiveAmount('Kosten'),
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

function str(fd: FormData, key: string): string {
  return (fd.get(key) as string | null) ?? ''
}

function optStr(fd: FormData, key: string): string | undefined {
  const v = str(fd, key)
  return v === '' ? undefined : v
}

function parseDetails(assetType: string, fd: FormData): AssetDetailsInput {
  switch (assetType) {
    case 'stock_etf': {
      const d = stockEtfSchema.parse({
        ticker:         str(fd, 'ticker'),
        isin:           optStr(fd, 'isin'),
        brokerId:       optStr(fd, 'brokerId'),
        accountType:    optStr(fd, 'accountType'),
        sector:         optStr(fd, 'sector'),
        instrumentType: optStr(fd, 'instrumentType'),
      })
      return { kind: 'stock_etf', ticker: d.ticker, isin: d.isin, brokerId: d.brokerId, accountType: d.accountType, sector: d.sector, instrumentType: d.instrumentType }
    }
    case 'crypto': {
      const d = cryptoSchema.parse({ ticker: str(fd, 'ticker'), walletOrExchange: optStr(fd, 'walletOrExchange') })
      const rawTicker = d.ticker.trim().toUpperCase()
      const normalizedTicker = rawTicker.includes('-') ? rawTicker : `${rawTicker}-EUR`
      return { kind: 'crypto', ticker: normalizedTicker, walletOrExchange: d.walletOrExchange }
    }
    case 'savings': {
      const d = savingsSchema.parse({ bankName: str(fd, 'bankName'), savingsAccountType: optStr(fd, 'savingsAccountType'), interestRate: optStr(fd, 'interestRate') })
      return { kind: 'savings', bankName: d.bankName, accountType: d.savingsAccountType, interestRate: d.interestRate }
    }
    case 'pension': {
      const d = pensionSchema.parse({ provider: str(fd, 'provider'), pensionType: str(fd, 'pensionType'), projectedAnnualBenefit: optStr(fd, 'projectedAnnualBenefit') })
      return { kind: 'pension', provider: d.provider, pensionType: d.pensionType, projectedAnnualBenefit: d.projectedAnnualBenefit }
    }
    case 'real_estate': {
      const d = realEstateSchema.parse({
        street:        str(fd, 'street'),
        postalCode:    optStr(fd, 'postalCode'),
        city:          str(fd, 'city'),
        propertyType:  str(fd, 'propertyType'),
        purchasePrice: str(fd, 'purchasePrice'),
        purchaseCosts: str(fd, 'purchaseCosts') || '0',
        purchaseDate:  str(fd, 'purchaseDate'),
        wozValue:      optStr(fd, 'wozValue'),
        mortgageLender:         optStr(fd, 'mortgageLender'),
        mortgageOriginalAmount: optStr(fd, 'mortgageOriginalAmount'),
        mortgageInterestRate:   optStr(fd, 'mortgageInterestRate'),
        mortgageStartDate:      optStr(fd, 'mortgageStartDate'),
        mortgageEndDate:        optStr(fd, 'mortgageEndDate'),
        mortgageType:           optStr(fd, 'mortgageType'),
      })
      const hasMortgage = d.mortgageLender && d.mortgageOriginalAmount && d.mortgageInterestRate && d.mortgageStartDate && d.mortgageType
      return {
        kind: 'real_estate',
        street: d.street,
        postalCode: d.postalCode,
        city: d.city,
        propertyType: d.propertyType,
        purchasePrice: d.purchasePrice,
        purchaseCosts: d.purchaseCosts,
        purchaseDate: d.purchaseDate,
        wozValue: d.wozValue,
        mortgage: hasMortgage ? {
          lender: d.mortgageLender!,
          originalAmount: d.mortgageOriginalAmount!,
          interestRate: d.mortgageInterestRate!,
          startDate: d.mortgageStartDate!,
          endDate: d.mortgageEndDate || null,
          mortgageType: d.mortgageType!,
        } : null,
      }
    }
    case 'vordering': {
      const d = vorderingSchema.parse({
        counterparty:    str(fd, 'counterparty'),
        principalAmount: str(fd, 'principalAmount'),
        interestRate:    optStr(fd, 'interestRate'),
        startDate:       optStr(fd, 'startDate'),
        endDate:         optStr(fd, 'endDate'),
        loanType:        optStr(fd, 'loanType'),
      })
      return { kind: 'vordering', counterparty: d.counterparty, principalAmount: d.principalAmount, interestRate: d.interestRate, startDate: d.startDate, endDate: d.endDate, loanType: d.loanType }
    }
    default:
      throw new Error(`Onbekend asset type: ${assetType}`)
  }
}

// ─── Asset actions ────────────────────────────────────────────────────────────

export async function createAssetAction(prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireUser()
    const assetTypeRaw = str(fd, 'assetType')
    const name = assetTypeRaw === 'real_estate'
      ? [str(fd, 'street'), str(fd, 'city')].filter(Boolean).join(', ')
      : str(fd, 'name')
    const base = baseSchema.parse({ name, assetType: assetTypeRaw, currency: str(fd, 'currency') || 'EUR' })
    const details = parseDetails(base.assetType, fd)

    if (details.kind === 'crypto' && details.ticker) {
      try {
        await getLatestPrice(details.ticker)
      } catch {
        return { error: `Geen koers gevonden voor '${details.ticker}'. Controleer het symbool of voeg het handmatig toe via een waarderingsinvoer.` }
      }
    }

    const asset = await createAsset(user.id, { ...base, details })

    // Initiële aankoop-transactie vanuit de zoekflow
    const purchasePrice    = optStr(fd, 'purchasePrice')
    const purchaseQuantity = optStr(fd, 'purchaseQuantity')
    const purchaseDate     = optStr(fd, 'purchaseDate')
    if (purchasePrice && purchaseQuantity && purchaseDate) {
      const amount = new Decimal(purchasePrice).times(new Decimal(purchaseQuantity))
      await createTransaction(user.id, asset.id, {
        transactionType: 'buy',
        amount:          amount.toFixed(2),
        quantity:        purchaseQuantity,
        pricePerUnit:    purchasePrice,
        transactionDate: purchaseDate,
        currency:        base.currency,
        fxRate:          '1',
      })
    }

    // Vastgoed heeft geen "buy"-transactie-flow (huidige waarde komt uit
    // asset_valuations, niet uit transacties) — zonder dit blijft de huidige
    // waarde 0 tot iemand handmatig een waardering toevoegt, terwijl de
    // aankoopprijs al bekend is. Aankoopprijs wordt daarom meteen de eerste
    // waardering, op de aankoopdatum.
    if (details.kind === 'real_estate' && purchasePrice && purchaseDate) {
      await createValuation(user.id, asset.id, {
        valuationDate: purchaseDate,
        value:         purchasePrice,
        currency:      base.currency,
      })
    }

    // WOZ-waarde is een apart historisch gegeven (zie schema.ts) — de bij
    // aanmaken ingevoerde waarde wordt meteen de eerste WOZ-snapshot, zodat
    // "WOZ-waarde bijwerken" niet leeg start terwijl er al een waarde bekend is.
    if (details.kind === 'real_estate' && details.wozValue && purchaseDate) {
      await createWozValue(user.id, asset.id, {
        wozDate: purchaseDate,
        value:   details.wozValue,
      })
    }

    const redirectBase = str(fd, 'redirectBase')
    redirect(redirectBase ? `${redirectBase}/${asset.id}` : `/assets/${asset.id}`)
  } catch (e) {
    if (isRedirectError(e)) throw e
    if (e instanceof z.ZodError) return { error: e.issues[0].message }
    return { error: e instanceof Error ? e.message : 'Onbekende fout' }
  }
}

export async function updateAssetAction(prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireUser()
    const assetId = str(fd, 'assetId')
    const assetTypeRaw = str(fd, 'assetType')
    const name = assetTypeRaw === 'real_estate'
      ? [str(fd, 'street'), str(fd, 'city')].filter(Boolean).join(', ')
      : str(fd, 'name')
    const base = baseSchema.parse({ name, assetType: assetTypeRaw, currency: str(fd, 'currency') || 'EUR' })
    const details = parseDetails(base.assetType, fd)
    await updateAsset(user.id, assetId, { name: base.name, currency: base.currency, details })
    redirect(str(fd, 'redirectTo') || `/assets/${assetId}`)
  } catch (e) {
    if (isRedirectError(e)) throw e
    if (e instanceof z.ZodError) return { error: e.issues[0].message }
    return { error: e instanceof Error ? e.message : 'Onbekende fout' }
  }
}

export async function deleteAssetAction(fd: FormData): Promise<void> {
  const user = await requireUser()
  const assetId = fd.get('assetId') as string
  const redirectTo = fd.get('redirectTo') as string | null
  await deleteAsset(user.id, assetId)
  redirect(redirectTo ?? '/assets')
}

// ─── Transaction actions ──────────────────────────────────────────────────────

const repeatSchema = z.object({
  repeatFrequency: z.enum(['monthly', 'four_weekly', 'quarterly', 'yearly']),
  repeatCount:     z.coerce.number().int().min(1, 'Aantal keer moet minstens 1 zijn').max(60, 'Maximaal 60 herhalingen per keer'),
})

/**
 * Telt een datum een aantal frequentie-stappen op — puur kalenderrekenwerk
 * (geen geldbedrag), vandaar hier en niet in lib/finance. `steps` is het
 * aantal periodes ná de oorspronkelijke datum (0 = de datum zelf).
 */
function advanceDate(dateStr: string, frequency: string, steps: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  if (frequency === 'monthly') d.setMonth(d.getMonth() + steps)
  else if (frequency === 'four_weekly') d.setDate(d.getDate() + steps * 28)
  else if (frequency === 'quarterly') d.setMonth(d.getMonth() + steps * 3)
  else if (frequency === 'yearly') d.setFullYear(d.getFullYear() + steps)
  return d.toISOString().slice(0, 10)
}

export async function createTransactionAction(prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireUser()
    const assetId = str(fd, 'assetId')
    const data = transactionSchema.parse({
      transactionType: str(fd, 'transactionType'),
      amount:          str(fd, 'amount'),
      quantity:        optStr(fd, 'quantity'),
      pricePerUnit:    optStr(fd, 'pricePerUnit'),
      transactionDate: str(fd, 'transactionDate'),
      currency:        str(fd, 'currency') || 'EUR',
      fxRate:          str(fd, 'fxRate') || '1',
      notes:           optStr(fd, 'notes'),
      fees:            optStr(fd, 'fees'),
    })
    const asset = await getAsset(user.id, assetId)
    if (!asset) return { error: 'Asset niet gevonden' }
    const allowed = ALLOWED_TX_TYPES[asset.assetType as AssetType]
    if (allowed && !allowed.includes(data.transactionType as TransactionType)) {
      return { error: `Transactietype '${data.transactionType}' is niet toegestaan voor dit asset type` }
    }

    if (str(fd, 'repeat') === 'on') {
      const repeatData = repeatSchema.parse({
        repeatFrequency: str(fd, 'repeatFrequency'),
        repeatCount:     str(fd, 'repeatCount'),
      })
      for (let i = 0; i < repeatData.repeatCount; i++) {
        await createTransaction(user.id, assetId, {
          ...data,
          transactionDate: advanceDate(data.transactionDate, repeatData.repeatFrequency, i),
        })
      }
    } else {
      await createTransaction(user.id, assetId, data)
    }

    redirect(str(fd, 'redirectTo') || `/assets/${assetId}`)
  } catch (e) {
    if (isRedirectError(e)) throw e
    if (e instanceof z.ZodError) return { error: e.issues[0].message }
    return { error: e instanceof Error ? e.message : 'Onbekende fout' }
  }
}

export async function updateTransactionAction(prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireUser()
    const transactionId = str(fd, 'transactionId')
    const assetId = str(fd, 'assetId')
    const data = transactionSchema.parse({
      transactionType: str(fd, 'transactionType'),
      amount:          str(fd, 'amount'),
      quantity:        optStr(fd, 'quantity'),
      pricePerUnit:    optStr(fd, 'pricePerUnit'),
      transactionDate: str(fd, 'transactionDate'),
      currency:        str(fd, 'currency') || 'EUR',
      fxRate:          str(fd, 'fxRate') || '1',
      notes:           optStr(fd, 'notes'),
      fees:            optStr(fd, 'fees'),
    })
    await updateTransaction(user.id, transactionId, data)
    redirect(str(fd, 'redirectTo') || `/assets/${assetId}`)
  } catch (e) {
    if (isRedirectError(e)) throw e
    if (e instanceof z.ZodError) return { error: e.issues[0].message }
    return { error: e instanceof Error ? e.message : 'Onbekende fout' }
  }
}

export async function deleteTransactionAction(fd: FormData): Promise<void> {
  const user = await requireUser()
  const transactionId = fd.get('transactionId') as string
  const assetId = fd.get('assetId') as string
  const redirectTo = fd.get('redirectTo') as string | null
  await deleteTransaction(user.id, transactionId)
  redirect(redirectTo ?? `/assets/${assetId}`)
}

// ─── Valuation actions ────────────────────────────────────────────────────────

const valuationSchema = z.object({
  valuationDate: z.string().min(1, 'Datum is verplicht'),
  value:         positiveAmount('Waarde'),
  currency:      z.string().default('EUR'),
})

export async function createValuationAction(prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireUser()
    const assetId = str(fd, 'assetId')
    const data = valuationSchema.parse({
      valuationDate: str(fd, 'valuationDate'),
      value:         str(fd, 'value'),
      currency:      str(fd, 'currency') || 'EUR',
    })
    await createValuation(user.id, assetId, data)
    redirect(str(fd, 'redirectTo') || `/assets/${assetId}`)
  } catch (e) {
    if (isRedirectError(e)) throw e
    if (e instanceof z.ZodError) return { error: e.issues[0].message }
    return { error: e instanceof Error ? e.message : 'Onbekende fout' }
  }
}

export async function updateValuationAction(fd: FormData): Promise<void> {
  const user = await requireUser()
  const valuationId = str(fd, 'valuationId')
  if (!valuationId) throw new Error('Geen waardering-ID opgegeven')
  const data = valuationSchema.parse({
    valuationDate: str(fd, 'valuationDate'),
    value:         str(fd, 'value'),
    currency:      str(fd, 'currency') || 'EUR',
  })
  await updateValuation(user.id, valuationId, data)
  revalidatePath('/assets/[id]', 'page')
  revalidatePath('/portfolio/vastgoed/[id]', 'page')
}

export async function deleteValuationAction(fd: FormData): Promise<void> {
  const user = await requireUser()
  const valuationId = fd.get('valuationId') as string
  await deleteValuation(user.id, valuationId)
  revalidatePath('/assets/[id]', 'page')
  revalidatePath('/portfolio/vastgoed/[id]', 'page')
}

// ─── Mortgage balance actions ─────────────────────────────────────────────────

const mortgageBalanceSchema = z.object({
  balanceDate:        z.string().min(1, 'Datum is verplicht'),
  outstandingBalance: positiveAmount('Restschuld'),
})

export async function createMortgageBalanceAction(prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireUser()
    const mortgageId = str(fd, 'mortgageId')
    const assetId    = str(fd, 'assetId')
    const data = mortgageBalanceSchema.parse({
      balanceDate:        str(fd, 'balanceDate'),
      outstandingBalance: str(fd, 'outstandingBalance'),
    })
    await createMortgageBalance(user.id, mortgageId, data)
    redirect(`/assets/${assetId}`)
  } catch (e) {
    if (isRedirectError(e)) throw e
    if (e instanceof z.ZodError) return { error: e.issues[0].message }
    return { error: e instanceof Error ? e.message : 'Onbekende fout' }
  }
}

export async function updateMortgageBalanceAction(fd: FormData): Promise<void> {
  const user = await requireUser()
  const balanceId = str(fd, 'balanceId')
  if (!balanceId) throw new Error('Geen saldo-ID opgegeven')
  const data = mortgageBalanceSchema.parse({
    balanceDate:        str(fd, 'balanceDate'),
    outstandingBalance: str(fd, 'outstandingBalance'),
  })
  await updateMortgageBalance(user.id, balanceId, data)
  revalidatePath('/assets/[id]', 'page')
  revalidatePath('/portfolio/vastgoed/[id]', 'page')
}

export async function deleteMortgageBalanceAction(fd: FormData): Promise<void> {
  const user = await requireUser()
  const balanceId = fd.get('balanceId') as string
  await deleteMortgageBalance(user.id, balanceId)
  revalidatePath('/assets/[id]', 'page')
  revalidatePath('/portfolio/vastgoed/[id]', 'page')
}

// ─── WOZ-waarde actions ─────────────────────────────────────────────────────

const wozValueSchema = z.object({
  wozDate: z.string().min(1, 'Datum is verplicht'),
  value:   positiveAmount('WOZ-waarde'),
})

export async function createWozValueAction(prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireUser()
    const assetId = str(fd, 'assetId')
    const data = wozValueSchema.parse({
      wozDate: str(fd, 'wozDate'),
      value:   str(fd, 'value'),
    })
    await createWozValue(user.id, assetId, data)
    redirect(str(fd, 'redirectTo') || `/assets/${assetId}`)
  } catch (e) {
    if (isRedirectError(e)) throw e
    if (e instanceof z.ZodError) return { error: e.issues[0].message }
    return { error: e instanceof Error ? e.message : 'Onbekende fout' }
  }
}

export async function updateWozValueAction(fd: FormData): Promise<void> {
  const user = await requireUser()
  const wozValueId = str(fd, 'wozValueId')
  if (!wozValueId) throw new Error('Geen WOZ-waarde-ID opgegeven')
  const data = wozValueSchema.parse({
    wozDate: str(fd, 'wozDate'),
    value:   str(fd, 'value'),
  })
  await updateWozValue(user.id, wozValueId, data)
  revalidatePath('/assets/[id]', 'page')
  revalidatePath('/portfolio/vastgoed/[id]', 'page')
  revalidatePath('/portfolio/vastgoed')
}

export async function deleteWozValueAction(fd: FormData): Promise<void> {
  const user = await requireUser()
  const wozValueId = fd.get('wozValueId') as string
  await deleteWozValue(user.id, wozValueId)
  revalidatePath('/assets/[id]', 'page')
  revalidatePath('/portfolio/vastgoed/[id]', 'page')
  revalidatePath('/portfolio/vastgoed')
}

// ─── Doorlopende huur/kosten-periode actions ───────────────────────────────
// Alternatief voor losse maandelijkse rental_income/cost-transacties: 1 rij
// per periode (vanaf-datum, evt. tot-datum, bedrag per maand). Zie
// recurringCashflows in schema.ts. Bestaande losse transacties blijven gewoon
// meetellen — deze periodes komen er in de jaartotalen bovenop.

const recurringCashflowSchema = z.object({
  cashflowType: z.enum(['rental_income', 'cost']),
  amount:       positiveAmount('Bedrag'),
  frequency:    z.enum(['monthly', 'once']),
  startDate:    z.string().min(1, 'Startdatum is verplicht'),
  endDate:      z.string().optional(),
  notes:        z.string().optional(),
}).refine(d => d.frequency !== 'monthly' || !d.endDate || d.endDate >= d.startDate, {
  message: 'Einddatum moet op of na de startdatum liggen',
  path: ['endDate'],
})

export async function createRecurringCashflowAction(prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireUser()
    const assetId = str(fd, 'assetId')
    const data = recurringCashflowSchema.parse({
      cashflowType: str(fd, 'cashflowType'),
      amount:       str(fd, 'amount'),
      frequency:    str(fd, 'frequency'),
      startDate:    str(fd, 'startDate'),
      endDate:      optStr(fd, 'endDate'),
      notes:        optStr(fd, 'notes'),
    })
    await createRecurringCashflow(user.id, assetId, {
      ...data,
      endDate: data.frequency === 'once' ? null : (data.endDate ?? null),
    })
    redirect(str(fd, 'redirectTo') || `/assets/${assetId}`)
  } catch (e) {
    if (isRedirectError(e)) throw e
    if (e instanceof z.ZodError) return { error: e.issues[0].message }
    return { error: e instanceof Error ? e.message : 'Onbekende fout' }
  }
}

export async function updateRecurringCashflowAction(fd: FormData): Promise<void> {
  const user = await requireUser()
  const recurringCashflowId = str(fd, 'recurringCashflowId')
  if (!recurringCashflowId) throw new Error('Geen periode-ID opgegeven')
  const data = recurringCashflowSchema.parse({
    cashflowType: str(fd, 'cashflowType'),
    amount:       str(fd, 'amount'),
    frequency:    str(fd, 'frequency'),
    startDate:    str(fd, 'startDate'),
    endDate:      optStr(fd, 'endDate'),
    notes:        optStr(fd, 'notes'),
  })
  await updateRecurringCashflow(user.id, recurringCashflowId, {
    ...data,
    endDate: data.frequency === 'once' ? null : (data.endDate ?? null),
  })
  revalidatePath('/assets/[id]', 'page')
  revalidatePath('/portfolio/vastgoed/[id]', 'page')
  revalidatePath('/portfolio/vastgoed')
}

export async function deleteRecurringCashflowAction(fd: FormData): Promise<void> {
  const user = await requireUser()
  const recurringCashflowId = fd.get('recurringCashflowId') as string
  await deleteRecurringCashflow(user.id, recurringCashflowId)
  revalidatePath('/assets/[id]', 'page')
  revalidatePath('/portfolio/vastgoed/[id]', 'page')
  revalidatePath('/portfolio/vastgoed')
}
