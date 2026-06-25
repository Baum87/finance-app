'use client'

import { useActionState, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { ActionState } from '@/app/assets/actions'
import type { AssetDetail } from '@/lib/db/queries/assets'
import { StockSearchInput } from './StockSearchInput'

type AssetType = 'stock_etf' | 'crypto' | 'savings' | 'real_estate' | 'pension' | 'vordering'

const ASSET_TYPE_OPTIONS: { value: AssetType; label: string }[] = [
  { value: 'stock_etf',   label: 'Aandeel / ETF' },
  { value: 'crypto',      label: 'Crypto' },
  { value: 'savings',     label: 'Spaarrekening' },
  { value: 'real_estate', label: 'Vastgoed' },
  { value: 'pension',     label: 'Pensioen' },
  { value: 'vordering',   label: 'Vordering' },
]

type Broker = { id: string; name: string }

type Props = {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>
  initialData?: NonNullable<AssetDetail>
  assetId?: string
  lockedType?: string
  redirectTo?: string
  redirectBase?: string
  cancelHref?: string
  defaultBrokerId?: string
  brokerList?: Broker[]
  walletList?: string[]
}

function Field({ label, name, type = 'text', defaultValue, placeholder, required }: {
  label: string
  name: string
  type?: string
  defaultValue?: string
  placeholder?: string
  required?: boolean
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={name}>{label}{required && <span className="text-terracotta ml-0.5">*</span>}</Label>
      <Input id={name} name={name} type={type} defaultValue={defaultValue} placeholder={placeholder} />
    </div>
  )
}

function StockEtfSection({ data, brokerList, defaultBrokerId }: {
  data?: NonNullable<AssetDetail>['stockEtfDetails']
  brokerList?: Broker[]
  defaultBrokerId?: string
}) {
  const currentBrokerId = data?.brokerId ?? defaultBrokerId ?? ''
  return (
    <div className="space-y-4 pt-4 border-t border-border">
      <p className="text-sm font-medium text-foreground">Beleggingsdetails</p>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Ticker" name="ticker" defaultValue={data?.ticker} placeholder="VWRL" required />
        <Field label="ISIN" name="isin" defaultValue={data?.isin ?? ''} placeholder="IE00B3RBWM25" />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="brokerId">Broker</Label>
          <select name="brokerId" id="brokerId" defaultValue={currentBrokerId}
            className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm transition-colors">
            <option value="">— Geen broker —</option>
            {(brokerList ?? []).map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="accountType">Accounttype</Label>
          <select name="accountType" id="accountType" defaultValue={data?.accountType ?? 'taxable'}
            className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm transition-colors">
            <option value="taxable">Belastbaar (box 3)</option>
            <option value="isa">ISA / Vrijgesteld</option>
          </select>
        </div>
      </div>
    </div>
  )
}

function CryptoSection({ data, walletList }: {
  data?: NonNullable<AssetDetail>['cryptoDetails']
  walletList?: string[]
}) {
  const hasWallets = (walletList?.length ?? 0) > 0
  return (
    <div className="space-y-4 pt-4 border-t border-border">
      <p className="text-sm font-medium text-foreground">Crypto details</p>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="walletOrExchange">Wallet / Exchange</Label>
          <Input
            id="walletOrExchange"
            name="walletOrExchange"
            defaultValue={data?.walletOrExchange ?? ''}
            placeholder="Bitvavo"
            list={hasWallets ? 'wallet-suggestions' : undefined}
          />
          {hasWallets && (
            <datalist id="wallet-suggestions">
              {walletList!.map(w => <option key={w} value={w} />)}
            </datalist>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ticker">Symbol<span className="text-terracotta ml-0.5">*</span></Label>
          <Input id="ticker" name="ticker" defaultValue={data?.ticker} placeholder="BTC-EUR" />
          <p className="text-xs text-muted-foreground">Crypto-ticker. Wordt automatisch in euro's opgehaald. Voorbeelden: BTC-EUR, ETH-EUR, SOL-EUR.</p>
        </div>
      </div>
    </div>
  )
}

function SavingsSection({ data }: { data?: NonNullable<AssetDetail>['savingsDetails'] }) {
  return (
    <div className="space-y-4 pt-4 border-t border-border">
      <p className="text-sm font-medium text-foreground">Spaarrekening details</p>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Bank" name="bankName" defaultValue={data?.bankName} placeholder="ING" required />
        <Field label="Rente (%)" name="interestRate" defaultValue={data?.interestRate ?? ''} placeholder="1.50" />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="savingsAccountType">Rekeningtype</Label>
          <select name="savingsAccountType" id="savingsAccountType" defaultValue={data?.accountType ?? 'savings'}
            className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm transition-colors">
            <option value="savings">Spaarrekening</option>
            <option value="checking">Betaalrekening</option>
            <option value="fixed">Deposito</option>
          </select>
        </div>
      </div>
    </div>
  )
}

function PensionSection({ data }: { data?: NonNullable<AssetDetail>['pensionDetails'] }) {
  return (
    <div className="space-y-4 pt-4 border-t border-border">
      <p className="text-sm font-medium text-foreground">Pensioen details</p>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Aanbieder" name="provider" defaultValue={data?.provider} placeholder="ABP" required />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pensionType">Type<span className="text-terracotta ml-0.5">*</span></Label>
          <select name="pensionType" id="pensionType" defaultValue={data?.pensionType ?? 'defined_benefit'}
            className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm transition-colors">
            <option value="defined_benefit">Defined benefit</option>
            <option value="defined_contribution">Defined contribution</option>
            <option value="annuity">Lijfrente</option>
          </select>
        </div>
        <Field label="Verwachte jaaruitkering (€)" name="projectedAnnualBenefit" defaultValue={data?.projectedAnnualBenefit ?? ''} placeholder="18000" />
      </div>
    </div>
  )
}

function VorderingSection({ data }: { data?: NonNullable<AssetDetail>['vorderingDetails'] }) {
  return (
    <div className="space-y-4 pt-4 border-t border-border">
      <p className="text-sm font-medium text-foreground">Vordering details</p>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Schuldenaar" name="counterparty" defaultValue={data?.counterparty} placeholder="Jan Jansen" required />
        <Field label="Geleend bedrag (€)" name="principalAmount" defaultValue={data?.principalAmount} placeholder="25000" required />
        <Field label="Rente (%)" name="interestRate" defaultValue={data?.interestRate ?? ''} placeholder="3.00" />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="loanType" className="text-sm font-medium leading-none">Type lening</label>
          <select name="loanType" id="loanType" defaultValue={data?.loanType ?? 'family'}
            className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm transition-colors">
            <option value="family">Familielening</option>
            <option value="business">Zakelijk</option>
            <option value="other">Overig</option>
          </select>
        </div>
        <Field label="Startdatum" name="startDate" type="date" defaultValue={data?.startDate ?? ''} />
        <Field label="Verwachte einddatum" name="endDate" type="date" defaultValue={data?.endDate ?? ''} />
      </div>
    </div>
  )
}

function RealEstateSection({ data, propertyType, onPropertyTypeChange }: {
  data?: NonNullable<AssetDetail>['realEstateDetails']
  propertyType: string
  onPropertyTypeChange: (v: string) => void
}) {
  const mortgage = (data as any)?.mortgages?.[0]
  return (
    <div className="space-y-4 pt-4 border-t border-border">
      <p className="text-sm font-medium text-foreground">Vastgoed details</p>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="propertyType">Type<span className="text-terracotta ml-0.5">*</span></Label>
          <select name="propertyType" id="propertyType" value={propertyType}
            onChange={e => onPropertyTypeChange(e.target.value)}
            className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm transition-colors">
            <option value="primary_residence">Eigen woning</option>
            <option value="rental">Verhuur</option>
            <option value="vacation">Vakantiewoning</option>
          </select>
        </div>
        <Field label="Adres" name="address" defaultValue={data?.address ?? ''} placeholder="Keizersgracht 1, Amsterdam" />
        <Field label="Aankoopprijs (€)" name="purchasePrice" defaultValue={data?.purchasePrice} placeholder="350000" required />
        <Field label="Aankoopkosten (€)" name="purchaseCosts" defaultValue={data?.purchaseCosts ?? '0'} placeholder="15000" />
        <Field label="Aankoopdatum" name="purchaseDate" type="date" defaultValue={data?.purchaseDate} required />
        <Field label="WOZ-waarde (€)" name="wozValue" defaultValue={data?.wozValue ?? ''} placeholder="420000" />
      </div>

      {/* Hypotheek */}
      <div className="space-y-4 pt-4 border-t border-border">
        <p className="text-sm font-medium text-foreground">Hypotheek <span className="text-muted-foreground font-normal">(optioneel)</span></p>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Geldverstrekker" name="mortgageLender" defaultValue={mortgage?.lender ?? ''} placeholder="Rabobank" />
          <Field label="Oorspronkelijk bedrag (€)" name="mortgageOriginalAmount" defaultValue={mortgage?.originalAmount ?? ''} placeholder="310000" />
          <Field label="Rente (%)" name="mortgageInterestRate" defaultValue={mortgage?.interestRate ?? ''} placeholder="3.50" />
          <Field label="Startdatum" name="mortgageStartDate" type="date" defaultValue={mortgage?.startDate ?? ''} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mortgageType">Hypotheekvorm</Label>
            <select name="mortgageType" id="mortgageType" defaultValue={mortgage?.mortgageType ?? 'annuity'}
              className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm transition-colors">
              <option value="annuity">Annuïteit</option>
              <option value="linear">Lineair</option>
              <option value="interest_only">Aflossingsvrij</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  )
}

export function AssetForm({ action, initialData, assetId, lockedType, redirectTo, redirectBase, cancelHref = '/assets', defaultBrokerId, brokerList, walletList }: Props) {
  const [state, formAction, isPending] = useActionState(action, null)
  const [assetType, setAssetType] = useState<AssetType>(
    (initialData?.assetType as AssetType) ?? (lockedType as AssetType) ?? 'stock_etf'
  )
  const [propertyType, setPropertyType] = useState(
    initialData?.realEstateDetails?.propertyType ?? 'primary_residence'
  )

  // For new stock_etf, StockSearchInput handles name and currency
  const isNewStockEtf = assetType === 'stock_etf' && !initialData

  return (
    <form action={formAction} className="space-y-6">
      {assetId && <input type="hidden" name="assetId" value={assetId} />}
      {redirectTo && <input type="hidden" name="redirectTo" value={redirectTo} />}
      {redirectBase && <input type="hidden" name="redirectBase" value={redirectBase} />}

      {state?.error && (
        <div className="rounded-lg border border-terracotta/30 bg-terracotta/10 p-3 text-sm text-terracotta">
          {state.error}
        </div>
      )}

      {/* Basisvelden */}
      <div className="grid grid-cols-2 gap-4">
        {!isNewStockEtf && (
          <div className="col-span-2">
            <Field label="Naam" name="name" defaultValue={initialData?.name} placeholder="VWRL ETF" required />
          </div>
        )}
        {!lockedType && !initialData && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="assetType">Type<span className="text-terracotta ml-0.5">*</span></Label>
            <select
              name="assetType"
              id="assetType"
              value={assetType}
              onChange={e => setAssetType(e.target.value as AssetType)}
              className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm transition-colors"
            >
              {ASSET_TYPE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        )}
        {(lockedType || initialData) && (
          <input type="hidden" name="assetType" value={assetType} />
        )}
        {!isNewStockEtf && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="currency">Valuta</Label>
            <select name="currency" id="currency" defaultValue={initialData?.currency ?? 'EUR'}
              className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm transition-colors">
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
              <option value="GBP">GBP</option>
              <option value="BTC">BTC</option>
            </select>
          </div>
        )}
      </div>

      {/* Type-specifieke velden */}
      {isNewStockEtf                && <StockSearchInput defaultBrokerId={defaultBrokerId} brokerList={brokerList} backHref={cancelHref} />}
      {assetType === 'stock_etf' && initialData && <StockEtfSection data={initialData.stockEtfDetails ?? undefined} brokerList={brokerList} defaultBrokerId={defaultBrokerId} />}
      {assetType === 'crypto'      && <CryptoSection      data={initialData?.cryptoDetails ?? undefined} walletList={walletList} />}
      {assetType === 'savings'     && <SavingsSection     data={initialData?.savingsDetails ?? undefined} />}
      {assetType === 'pension'     && <PensionSection     data={initialData?.pensionDetails ?? undefined} />}
      {assetType === 'vordering'   && <VorderingSection   data={initialData?.vorderingDetails ?? undefined} />}
      {assetType === 'real_estate' && (
        <RealEstateSection
          data={initialData?.realEstateDetails ?? undefined}
          propertyType={propertyType}
          onPropertyTypeChange={setPropertyType}
        />
      )}

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {isPending ? 'Opslaan…' : 'Opslaan'}
        </button>
        <a href={cancelHref} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          Annuleren
        </a>
      </div>
    </form>
  )
}
