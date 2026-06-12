# Sprint 3.2 — Finance Engine & Koersdata

**Status:** Afgerond
**Datum:** 2026-06-12

---

## Doel

Financiële berekeningsfuncties bouwen (puur TypeScript, geen React/Drizzle), een koersdataservice implementeren via yahoo-finance2, en de asset-pagina's updaten met live KPI's.

---

## Taak A — Finance functies (`src/lib/finance/`)

### Gebouwde functies

| Bestand | Functies |
|---|---|
| `xirr.ts` | `calculateXirr` — Newton-Raphson met meerdere startpunten |
| `cost-basis.ts` | `calculateCostBasis` (AVCO), `calculateQuantityHeld` |
| `net-deposit.ts` | `calculateNetDeposit` — ingelegd kapitaal netto |
| `current-value.ts` | `calculateMarketValue`, `calculateSavingsBalance`, `calculateUnrealizedGain` |
| `passive-income.ts` | `calculatePassiveIncome` — dividend/rente/huurinkomen minus kosten, met datumfilter |
| `allocation.ts` | `calculateAllocation` — portfolio-allocatie per assettype |
| `real-estate.ts` | `calculateGrossRentalYield`, `calculateNetRentalYield`, `calculateCashOnCash`, `calculateLtv`, `calculateEquity` |
| `net-worth.ts` | `calculateNetWorth` — vermogen minus schulden |
| `twr.ts` | `calculateTwr` — Time-Weighted Return via groeifactoren |
| `benchmark.ts` | `calculateExcessReturn` — alpha t.o.v. benchmark |
| `net-worth-series.ts` | `buildNetWorthSeries` — tijdreeks vermogen op basis van valuaties |
| `index.ts` | Barrel export van alle functies |

### Technische keuzes
- Alle geldbedragen via `decimal.js` — nooit floating point
- Functies gooien een `Error` bij ongeldige input (bijv. startwaarde 0 in TWR)
- XIRR: meerdere startpunten (0.1, 0.0, −0.1, 0.5) voor robuuste convergentie
- TWR: werkt met groeifactoren (niet percentages) — `product = product × (endValue − cashflow) / startValue`

### Tests — `finance.test.ts` (Vitest)

43 tests, alle groen. Dekking:
- XIRR convergentie, irreguliere cashflows, negatief rendement, foutmeldingen
- AVCO kostprijs, partieel verkopen, positie nul
- Net deposit, savings balance, ongerealiseerde winst/verlies
- Passief inkomen met datumfilter
- Portfolio-allocatie (aggregatie per type, percentages)
- Vastgoed: bruto/netto yield, cash-on-cash, LTV, equity
- Nettovermogen, TWR (enkelvoudig + meervoudig), benchmark excess return
- Vermogensserie tijdreeks

**Bug gevonden en opgelost:** TWR-functie voegde 1 toe aan een groeifactor (die al ≥1 was), waardoor het resultaat structureel te hoog uitkwam. Gecorrigeerd door direct met de groeifactor te vermenigvuldigen zonder `+1`.

---

## Taak B — Koersdataservice & UI-updates

### `src/lib/services/prices.ts`

- `getLatestPrice(symbol)` — haalt live koers op via `yf.quote()`
- `getHistoricalPrices(symbol, from, to)` — dagelijkse slotkoersen via `yf.historical()`
- Geen API-sleutel nodig (yahoo-finance2 werkt anoniem)
- **Let op:** `yahoo-finance2` exporteert een constructor, niet een singleton — `new YahooFinance()` is vereist

### `src/lib/db/queries/assets.ts` — uitbreidingen

- `getAssetWithCalculations(userId, assetId)` — haalt asset op + berekent live KPI's:
  - stock_etf / crypto: live koers → marktwaarde, ongerealiseerde winst, XIRR
  - savings: saldo op basis van transacties
  - vastgoed / pensioen: laatste opgeslagen valuatie
  - Fallback bij mislukte koersophaling → laatste valuation
- `getAssetsWithValues(userId)` — alle actieve assets met `currentValue` (parallel price fetch)

### UI-updates

**`/assets` (lijstpagina):**
- Kolom "Laatste waarde" → "Huidige waarde" met live berekende waarde
- Gebruikt `getAssetsWithValues` i.p.v. `getAssets`

**`/assets/[id]` (detailpagina):**
- 4 KPI-kaarten: Huidige waarde (met koers als subtekst), Ingelegd, Ongerealiseerde winst (groen/rood), XIRR
- Extra rij voor aandelen/crypto: aantal in bezit + transactieteller
- Gebruikt `getAssetWithCalculations`

---

## Overige fixes in deze sprint

- `isRedirectError` importpad gecorrigeerd: `next/dist/client/components/redirect-error` (was `redirect`)
- `ZodError.issues[0].message` gecorrigeerd (was `.errors[0].message` — deprecated alias)
- `AssetDetail` type gewijzigd naar `NonNullable<...>` zodat callers niet op `undefined` hoeven te checken

---

## Bestandslijst (nieuw/gewijzigd)

**Nieuw:**
- `src/lib/finance/real-estate.ts`
- `src/lib/finance/net-worth.ts`
- `src/lib/finance/twr.ts`
- `src/lib/finance/benchmark.ts`
- `src/lib/finance/net-worth-series.ts`
- `src/lib/finance/index.ts`
- `src/lib/finance/finance.test.ts`
- `src/lib/services/prices.ts`
- `vitest.config.ts`

**Gewijzigd:**
- `src/lib/db/queries/assets.ts` — `getAssetWithCalculations`, `getAssetsWithValues`, `AssetDetail` type fix
- `src/components/assets/AssetList.tsx` — accepteert `AssetWithValue` ipv `AssetWithDetails`
- `src/app/assets/page.tsx` — gebruikt `getAssetsWithValues`
- `src/app/assets/[id]/page.tsx` — 4 KPI-kaarten met live berekeningen
- `src/app/assets/actions.ts` — fix `isRedirectError` import + `ZodError.issues`
- `package.json` — `yahoo-finance2`, `vitest` dependencies + test scripts

---

## Volgende sprint

Sprint 4 (SEO, security, testing) of Sprint 3.3 (Vermogen-dashboard met allocatiegrafiek en nettovermogen-tijdlijn).
