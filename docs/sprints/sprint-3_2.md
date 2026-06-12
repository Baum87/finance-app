# Sprint 3.2 — Rendementsberekeningen & koersdata

**Datum:** 12 juni 2026
**Status:** Gepland
**Commit:** —

## Doel

De finance-logica implementeren als pure TypeScript-functies, een koersdataservice koppelen en de berekeningen aansluiten op de UI — zodat de app rendement, netto vermogen en huidige waarden toont die daadwerkelijk kloppen.

---

## Scope

### In scope
- Alle functies uit `finance-logic.md` implementeren in `src/lib/finance/`
- Vitest-testbestand met alle testcases uit `finance-logic.md` (groen vereist voor afsluiting)
- Koersdataservice voor aandelen/ETF en crypto via `yahoo-finance2`
- `getAssets` / `getAsset` uitbreiden met berekende waarden
- Asset-detailpagina toont live: huidige waarde, XIRR, cost basis
- `/assets` toont huidige waarde per asset

### Buiten scope
- Dashboard en grafieken → Sprint 3.3
- CSV-import → Sprint 4.1
- Benchmark-vergelijking UI → Sprint 3.3 (TWR-functie wél nu bouwen)

---

## Taakverdeling Claude Code

### Taak A — `lib/finance` implementeren + testen

**Context meegeven:** `finance-logic.md`, `conventions.md`, `src/types/index.ts`

**Output:**
- `src/lib/finance/net-deposit.ts`
- `src/lib/finance/current-value.ts`
- `src/lib/finance/net-worth.ts`
- `src/lib/finance/allocation.ts`
- `src/lib/finance/passive-income.ts`
- `src/lib/finance/xirr.ts`
- `src/lib/finance/twr.ts`
- `src/lib/finance/benchmark.ts`
- `src/lib/finance/cost-basis.ts`
- `src/lib/finance/real-estate.ts`
- `src/lib/finance/net-worth-series.ts`
- `src/lib/finance/index.ts` (barrel export)
- `src/lib/finance/finance.test.ts` (alle testcases uit finance-logic.md)

**Vereisten:**
- Puur TypeScript — geen React, geen Drizzle, geen Supabase
- `decimal.js` gebruiken voor tussenberekeningen waar precisie kritisch is
- Finance-functies gooien een `Error` met duidelijke melding bij ongeldige input — nooit `NaN` of `0`
- Rendementen als decimaal: `0.07` = 7%
- Alle testcases uit finance-logic.md moeten groen zijn voor afsluiting

---

### Taak B — Koersdataservice + aansluiting op UI

**Context meegeven:** `architecture.md`, `data-model.md`, `sprint-3_1.md`, `conventions.md`

**Koersdatakeuze:** `yahoo-finance2` (geen API-sleutel, dekt aandelen + ETF + crypto)

**Output:**

`src/lib/services/prices.ts`
- `getLatestPrice(ticker: string, currency?: string): Promise<number>` — huidige koers in EUR
- `getHistoricalPrices(ticker: string, from: string, to: string): Promise<PricePoint[]>` — voor vermogensontwikkeling grafiek later
- Fallback: als yahoo-finance2 faalt, gooit de functie een duidelijke error (nooit stilletjes 0 teruggeven)
- FX-conversie naar EUR via koers uit `fx_rates` tabel of yahoo zelf

`src/lib/db/queries/assets.ts` — uitbreiden
- `getAssetWithCalculations(userId, assetId)` — asset + transacties + laatste valuation + berekende waarden:
  - `currentValue`: huidige waarde (transactie-gedreven of valuation-based)
  - `netDeposit`: netto inleg
  - `xirr`: intern rendement (als er ≥2 cashflows zijn)
  - `costBasis`: gemiddelde aankoopkoers (voor stock_etf en crypto)
- `getAssetsWithValues(userId)` — lijst met `currentValue` per asset (voor `/assets` pagina)

`src/app/assets/[id]/page.tsx` — uitbreiden
- KPI-cards tonen: huidige waarde, XIRR (%), netto inleg, ongerealiseerde winst
- Foutafhandeling als XIRR niet convergeert (te weinig data — toon "—" i.p.v. crash)

`src/app/assets/page.tsx` — uitbreiden
- Tabel toont `currentValue` per asset

**Vereisten:**
- `yahoo-finance2` als npm dependency
- API-calls alleen server-side (RSC / Server Actions) — nooit vanuit Client Components
- Koers ophalen is best-effort: als het mislukt, val terug op laatste bekende waarde uit `asset_valuations` of toon "—"
- Geen koers cachen in v1 — fresh fetch per page load (maandelijkse tool, geen performance-issue)

---

## Beslissingen

| Beslissing | Motivatie |
|---|---|
| `yahoo-finance2` voor koersdata | Gratis, geen account, dekt aandelen + ETF + crypto. Swappable service-laag als het ooit breekt. |
| Geen koers-caching in v1 | App is een maandelijkse review-tool, geen real-time dashboard. Fresh fetch per load is prima. |
| Vitest i.p.v. Jest | Past beter bij Next.js + Vite-omgeving; sneller, minder configuratie. |
| XIRR-fouten tonen als "—" in UI | Te weinig data (< 2 cashflows) is een normale beginstaat, geen crash-scenario. |

---

## Wat nog open staat na deze sprint

- Grafieken (vermogensontwikkeling, allocatie) → Sprint 3.3
- Cashflow-module (passief inkomen overzicht) → Sprint 3.4
- Benchmark-vergelijking UI → Sprint 3.3
