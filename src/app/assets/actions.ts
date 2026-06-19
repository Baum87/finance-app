'use server'

import { redirect } from 'next/navigation'
import { isRedirectError } from 'next/dist/client/components/redirect-error'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/db/supabase-server'
import {
  createAsset, updateAsset, deleteAsset,
} from '@/lib/db/queries/assets'
import {
  createTransaction, updateTransaction, deleteTransaction,
} from '@/lib/db/queries/transactions'
import { createValuation, deleteValuation } from '@/lib/db/queries/valuations'
import { createMortgageBalance } from '@/lib/db/queries/mortgage-balances'
import type { AssetDetailsInput } from '@/lib/db/queries/assets'
import Decimal from 'decimal.js'

export type ActionState = { error: string } | null

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function requireUser() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return user
}

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const baseSchema = z.object({
  name:      z.string().min(1, 'Naam is verplicht'),
  assetType: z.enum(['stock_etf', 'crypto', 'savings', 'real_estate', 'pension', 'vordering']),
  currency:  z.string().default('EUR'),
})

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
  interestRate:     z.string().optional(),
})

const pensionSchema = z.object({
  provider:               z.string().min(1, 'Aanbieder is verplicht'),
  pensionType:            z.string().min(1, 'Type is verplicht'),
  projectedAnnualBenefit: z.string().optional(),
})

const vorderingSchema = z.object({
  counterparty:    z.string().min(1, 'Naam schuldenaar is verplicht'),
  principalAmount: z.string().min(1, 'Geleend bedrag is verplicht'),
  interestRate:    z.string().optional(),
  startDate:       z.string().optional(),
  endDate:         z.string().optional(),
  loanType:        z.string().optional(),
})

const realEstateSchema = z.object({
  address:       z.string().optional(),
  propertyType:  z.enum(['rental', 'primary_residence', 'vacation']),
  purchasePrice: z.string().min(1, 'Aankoopprijs is verplicht'),
  purchaseCosts: z.string().default('0'),
  purchaseDate:  z.string().min(1, 'Aankoopdatum is verplicht'),
  wozValue:      z.string().optional(),
  // hypotheek (optioneel, alleen bij rental)
  mortgageLender:         z.string().optional(),
  mortgageOriginalAmount: z.string().optional(),
  mortgageInterestRate:   z.string().optional(),
  mortgageStartDate:      z.string().optional(),
  mortgageType:           z.string().optional(),
})

const transactionSchema = z.object({
  transactionType: z.enum(['buy', 'sell', 'deposit', 'withdrawal', 'dividend', 'interest', 'rental_income', 'cost']),
  amount:          z.string().min(1, 'Bedrag is verplicht'),
  quantity:        z.string().optional(),
  pricePerUnit:    z.string().optional(),
  transactionDate: z.string().min(1, 'Datum is verplicht'),
  currency:        z.string().default('EUR'),
  fxRate:          z.string().default('1'),
  notes:           z.string().optional(),
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
      return { kind: 'crypto', ticker: d.ticker, walletOrExchange: d.walletOrExchange }
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
        address:       optStr(fd, 'address'),
        propertyType:  str(fd, 'propertyType'),
        purchasePrice: str(fd, 'purchasePrice'),
        purchaseCosts: str(fd, 'purchaseCosts') || '0',
        purchaseDate:  str(fd, 'purchaseDate'),
        wozValue:      optStr(fd, 'wozValue'),
        mortgageLender:         optStr(fd, 'mortgageLender'),
        mortgageOriginalAmount: optStr(fd, 'mortgageOriginalAmount'),
        mortgageInterestRate:   optStr(fd, 'mortgageInterestRate'),
        mortgageStartDate:      optStr(fd, 'mortgageStartDate'),
        mortgageType:           optStr(fd, 'mortgageType'),
      })
      const hasMortgage = d.mortgageLender && d.mortgageOriginalAmount && d.mortgageInterestRate && d.mortgageStartDate && d.mortgageType
      return {
        kind: 'real_estate',
        address: d.address,
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
    const base = baseSchema.parse({ name: str(fd, 'name'), assetType: str(fd, 'assetType'), currency: str(fd, 'currency') || 'EUR' })
    const details = parseDetails(base.assetType, fd)
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
    const base = baseSchema.parse({ name: str(fd, 'name'), assetType: str(fd, 'assetType'), currency: str(fd, 'currency') || 'EUR' })
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
    })
    await createTransaction(user.id, assetId, data)
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
  value:         z.string().min(1, 'Waarde is verplicht'),
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

export async function deleteValuationAction(fd: FormData): Promise<void> {
  const user = await requireUser()
  const valuationId = fd.get('valuationId') as string
  const redirectTo  = fd.get('redirectTo') as string | null
  await deleteValuation(user.id, valuationId)
  redirect(redirectTo ?? '/assets')
}

// ─── Mortgage balance actions ─────────────────────────────────────────────────

const mortgageBalanceSchema = z.object({
  balanceDate:        z.string().min(1, 'Datum is verplicht'),
  outstandingBalance: z.string().min(1, 'Restschuld is verplicht'),
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
