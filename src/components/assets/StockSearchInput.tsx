'use client'

import { useState, useRef } from 'react'
import {
  searchStocksAction, getStockQuoteAction, checkTickerExistsAction,
  type StockSearchResult, type ExistingPosition,
} from '@/app/portfolio/aandelen-etf/market-actions'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Broker = { id: string; name: string }

type Props = {
  defaultBrokerId?: string
  brokerList?: Broker[]
  backHref?: string
}

const today = new Date().toISOString().split('T')[0]

export function StockSearchInput({ defaultBrokerId = '', brokerList = [], backHref = '/portfolio/aandelen-etf' }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<StockSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isFetchingPrice, setIsFetchingPrice] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const [name, setName] = useState('')
  const [ticker, setTicker] = useState('')
  const [isin, setIsin] = useState('')
  const [brokerId, setBrokerId] = useState(defaultBrokerId)
  const [accountType, setAccountType] = useState('taxable')
  const [sector, setSector] = useState('')
  const [instrumentType, setInstrumentType] = useState('stock')

  // Aankoopdata (wat de gebruiker betaalde)
  const [purchasePrice, setPurchasePrice] = useState('')
  const [purchaseQuantity, setPurchaseQuantity] = useState('')
  const [purchaseDate, setPurchaseDate] = useState(today)

  // Live marktkoers — alleen als referentie, niet voor submit
  const [livePrice, setLivePrice] = useState<{ eur: number; native: number; currency: string } | null>(null)

  // Duplicate check
  const [duplicates, setDuplicates] = useState<ExistingPosition[]>([])
  const [duplicateDismissed, setDuplicateDismissed] = useState(false)
  const checkTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  async function checkDuplicates(t: string) {
    if (!t) { setDuplicates([]); return }
    const found = await checkTickerExistsAction(t)
    setDuplicates(found)
    if (found.length > 0) setDuplicateDismissed(false)
  }

  function handleQueryChange(q: string) {
    setQuery(q)
    clearTimeout(timerRef.current)
    if (q.length < 2) { setResults([]); setShowDropdown(false); return }
    timerRef.current = setTimeout(async () => {
      setIsSearching(true)
      const res = await searchStocksAction(q)
      setResults(res)
      setShowDropdown(true)
      setIsSearching(false)
    }, 300)
  }

  async function handleSelect(stock: StockSearchResult) {
    setShowDropdown(false)
    setQuery('')
    setTicker(stock.symbol)
    setName(stock.name)
    setIsFetchingPrice(true)
    const [quote] = await Promise.all([
      getStockQuoteAction(stock.symbol),
      checkDuplicates(stock.symbol),
    ])
    if (quote) {
      if (quote.name) setName(quote.name)
      setLivePrice({ eur: quote.priceEur, native: quote.priceNative, currency: quote.nativeCurrency })
      if (!purchasePrice) setPurchasePrice(quote.priceEur.toFixed(4))
      if (quote.sector) setSector(quote.sector)
      setInstrumentType(quote.instrumentType)
    }
    setIsFetchingPrice(false)
  }

  function handleTickerChange(val: string) {
    const upper = val.toUpperCase()
    setTicker(upper)
    clearTimeout(checkTimerRef.current)
    checkTimerRef.current = setTimeout(() => checkDuplicates(upper), 600)
  }

  const totalCost = purchasePrice && purchaseQuantity
    ? (parseFloat(purchasePrice) * parseFloat(purchaseQuantity)) || 0
    : null

  const formatEur = (v: number) =>
    v.toLocaleString('nl-NL', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 })

  return (
    <div className="space-y-4 pt-4 border-t border-border">
      <p className="text-sm font-medium text-foreground">Beleggingsdetails</p>

      {/* Zoekbalk */}
      <div className="relative">
        <Label htmlFor="stock-search">Zoeken op naam of ticker</Label>
        <div className="relative mt-1.5">
          <Input
            id="stock-search"
            placeholder="bijv. VWRL of Vanguard All-World"
            value={query}
            onChange={e => handleQueryChange(e.target.value)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
            autoComplete="off"
          />
          {isSearching && (
            <span className="absolute right-3 top-2 text-xs text-muted-foreground">Zoeken…</span>
          )}
        </div>
        {showDropdown && results.length > 0 && (
          <div className="absolute z-20 top-full mt-1 w-full bg-card border border-border rounded-lg shadow-lg overflow-hidden">
            {results.map(r => (
              <button
                key={r.symbol}
                type="button"
                onMouseDown={() => handleSelect(r)}
                className="w-full text-left px-4 py-2.5 hover:bg-muted/50 transition-colors text-sm flex items-center gap-3 border-b border-border last:border-0"
              >
                <span className="font-mono text-xs font-semibold bg-muted px-1.5 py-0.5 rounded shrink-0">
                  {r.symbol}
                </span>
                <span className="flex-1 truncate">{r.name}</span>
                <span className="text-xs text-muted-foreground shrink-0">{r.exchange}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Hidden velden voor submit */}
      <input type="hidden" name="name" value={name} />
      <input type="hidden" name="currency" value="EUR" />
      <input type="hidden" name="sector" value={sector} />
      <input type="hidden" name="instrumentType" value={instrumentType} />

      <div className="grid grid-cols-2 gap-4">
        {/* Naam */}
        <div className="col-span-2 flex flex-col gap-1.5">
          <Label htmlFor="stock-name">
            Naam<span className="text-terracotta ml-0.5">*</span>
            {isFetchingPrice && <span className="ml-2 text-xs font-normal text-muted-foreground">Koers ophalen…</span>}
          </Label>
          <Input
            id="stock-name"
            placeholder="Vanguard FTSE All-World UCITS ETF"
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </div>

        {/* Ticker */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ticker">Ticker<span className="text-terracotta ml-0.5">*</span></Label>
          <Input
            id="ticker"
            name="ticker"
            placeholder="VWRL"
            value={ticker}
            onChange={e => handleTickerChange(e.target.value)}
          />
        </div>

        {/* ISIN */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="isin">ISIN</Label>
          <Input
            id="isin"
            name="isin"
            placeholder="IE00B3RBWM25"
            value={isin}
            onChange={e => setIsin(e.target.value)}
          />
        </div>

        {/* Broker */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="brokerId">Broker</Label>
          <select
            id="brokerId"
            name="brokerId"
            value={brokerId}
            onChange={e => setBrokerId(e.target.value)}
            className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm transition-colors"
          >
            <option value="">— Geen broker —</option>
            {brokerList.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>

        {/* Accounttype */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="accountType">Accounttype</Label>
          <select
            name="accountType"
            id="accountType"
            value={accountType}
            onChange={e => setAccountType(e.target.value)}
            className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm transition-colors"
          >
            <option value="taxable">Belastbaar (box 3)</option>
            <option value="isa">ISA / Vrijgesteld</option>
          </select>
        </div>

        {/* Instrument type */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="instrumentType">Type instrument</Label>
          <select
            id="instrumentType"
            value={instrumentType}
            onChange={e => setInstrumentType(e.target.value)}
            className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm transition-colors"
          >
            <option value="stock">Aandeel</option>
            <option value="etf">ETF</option>
            <option value="fund">Indexfonds</option>
          </select>
        </div>

        {/* Sector */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sector">Sector</Label>
          <Input
            id="sector"
            placeholder="bijv. Technology"
            value={sector}
            onChange={e => setSector(e.target.value)}
          />
        </div>
      </div>

      {/* Duplicate warning */}
      {duplicates.length > 0 && !duplicateDismissed && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 space-y-2">
          <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
            Je hebt {duplicates.length === 1 ? 'al een' : 'al meerdere'} {ticker}-positie{duplicates.length > 1 ? 's' : ''}.
          </p>
          <ul className="space-y-1.5">
            {duplicates.map(d => (
              <li key={d.assetId} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {d.assetName}{d.brokerName ? ` · ${d.brokerName}` : ''}
                </span>
                <a
                  href={`/assets/${d.assetId}/transactions/new?from=${backHref}`}
                  className="font-medium text-primary hover:underline shrink-0 ml-4"
                >
                  + Transactie toevoegen →
                </a>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setDuplicateDismissed(true)}
            className="text-xs text-muted-foreground hover:text-foreground underline mt-1"
          >
            Toch een nieuwe positie aanmaken (andere broker)
          </button>
        </div>
      )}

      {/* Aankoopgegevens */}
      <div className="space-y-3 pt-3 border-t border-border">
        <p className="text-sm font-medium text-foreground">Aankoop</p>

        {livePrice && (
          <div className="rounded-lg bg-muted/50 px-4 py-2.5 text-sm text-muted-foreground">
            Huidige marktkoers:{' '}
            <span className="font-medium text-foreground">{formatEur(livePrice.eur)}</span>
            {livePrice.currency !== 'EUR' && (
              <span className="ml-1.5">
                ({livePrice.native.toLocaleString('nl-NL', { minimumFractionDigits: 2 })} {livePrice.currency})
              </span>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          {/* Aankoopprijs per stuk */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="purchasePrice">
              Aankoopprijs per stuk (EUR)<span className="text-terracotta ml-0.5">*</span>
            </Label>
            <Input
              id="purchasePrice"
              name="purchasePrice"
              placeholder="0.00"
              value={purchasePrice}
              onChange={e => setPurchasePrice(e.target.value)}
            />
          </div>

          {/* Aantal */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="purchaseQuantity">
              Aantal<span className="text-terracotta ml-0.5">*</span>
            </Label>
            <Input
              id="purchaseQuantity"
              name="purchaseQuantity"
              placeholder="10"
              value={purchaseQuantity}
              onChange={e => setPurchaseQuantity(e.target.value)}
            />
          </div>

          {/* Aankoopdatum */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="purchaseDate">
              Aankoopdatum<span className="text-terracotta ml-0.5">*</span>
            </Label>
            <Input
              id="purchaseDate"
              name="purchaseDate"
              type="date"
              value={purchaseDate}
              onChange={e => setPurchaseDate(e.target.value)}
            />
          </div>

          {/* Totale aankoopkosten */}
          {totalCost !== null && totalCost > 0 && (
            <div className="flex flex-col justify-end">
              <div className="rounded-lg bg-muted/50 px-4 py-2.5 text-sm h-9 flex items-center">
                <span className="text-muted-foreground">Totaal:&nbsp;</span>
                <span className="font-semibold text-foreground">{formatEur(totalCost)}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
