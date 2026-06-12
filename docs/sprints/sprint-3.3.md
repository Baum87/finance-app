# Sprint 3.3 — Dashboard & Charts

**Status:** Afgerond
**Datum:** 2026-06-12

---

## Doel

Drie primaire pagina's gebouwd met echte data, live berekeningen en grafieken: Overzicht (`/`), Vermogen (`/vermogen`) en Vastgoed (`/vastgoed`).

---

## Taak 1 — Topbar

De Topbar bestond al uit Sprint 2.2 (`src/components/layout/Topbar.tsx`) en voldoet aan de sprint-eisen (sticky, actieve link, navigatie, sign-out). Geen wijzigingen nodig.

---

## Taak 2 — Overzicht (`/`)

**`src/app/page.tsx`** herbouwd met:

- Tijdgebaseerde begroeting (Goedemorgen/Goedemiddag/Goedenavond)
- Voornaam uit `user_metadata.full_name` of email prefix
- **Netto vermogen** berekend via `calculateNetWorth()` met echte asset values + hypotheeksaldi uit `getMortgageBalancesMap()`
- Actief doel — placeholder met disabled knop en lege voortgangsbalk
- AI Coach — placeholder tekst

---

## Taak 3 — Vermogen (`/vermogen`)

**`src/app/vermogen/page.tsx`** herbouwd als Server Component.

### Drie KPI-cards
| Card | Bron |
|---|---|
| Totaal vermogen | Som `currentValue` van liquide assets (stock_etf, crypto, savings) |
| Rendement dit jaar | Portfolio XIRR YTD — alle transacties van 1 jan t/m vandaag + sluitcashflow huidige waarde |
| vs. Benchmark | Placeholder "—" (volgt Sprint 3.4) |

### Vermogensontwikkeling grafiek
**`src/components/vermogen/NetWorthChart.tsx`** (`"use client"`):
- Recharts `<LineChart>` met één `<Line>` in `--color-chart-primary` (sage groen)
- Tijdfilter: 1M / 6M / 1J / Alles — client-side `useState`
- Grid: alleen horizontale lijnen, geen border
- Tooltip met nl-NL euro-opmaak
- Lege staat als er geen valuatiedata is
- Data komt via `buildNetWorthSeries()` op basis van `asset_valuations`

### Asset-tabel
**`src/components/vermogen/AssetTable.tsx`**:
- Kolommen: Naam, Type, Huidige waarde, Ingelegd, XIRR, +/−
- Gesorteerd op huidige waarde DESC
- XIRR en +/− in sage/terracotta kleur
- Klikbare naam → `/assets/[id]`

### Query-uitbreiding
**`getLiquidAssetsWithCalculations(userId)`** toegevoegd aan `assets.ts`:
- Filtert op `stock_etf`, `crypto`, `savings`
- Berekent per asset: netDeposit, unrealizedGain, XIRR

---

## Taak 4 — Vastgoed (`/vastgoed`)

**`src/app/vastgoed/page.tsx`** herbouwd als Server Component.

### Per vastgoedobject dynamisch sectieblok
- Filtert op `assetType === 'real_estate'`
- Laadt per asset `getAsset()` voor hypotheek + `getTransactions()`

**Eigen woning (`primary_residence`):**
- Woningwaarde (uit `asset_valuations`), hypotheek (uit `mortgage_balances.outstanding_balance`), eigen vermogen
- LTV `<ProgressBar>` met subtext

**Verhuurappartement (`rental`):**
- Netto huurrendement, cash-on-cash rendement, totaalrendement XIRR
- LTV `<ProgressBar>`
- Cashflow-tabel per jaar (laatste 3 jaar): huurinkomsten, kosten, netto

**Lege staat:** als geen vastgoed-assets aanwezig.

---

## Taak 5 — Gedeelde UI-componenten

**`src/components/ui/KpiCard.tsx`** (nieuw):
- Props: `label`, `value`, `subtext?`, `trend?`
- Trend toont kleur: positief = sage, negatief = terracotta

**`src/components/ui/ProgressBar.tsx`** (nieuw):
- Props: `value` (0–1), `label?`, `subtext?`
- Track: `bg-border`, fill: `bg-muted-foreground`, hoogte 6px

---

## Utilities

**`src/lib/utils/format.ts`** (nieuw):
```ts
formatCurrency(value) // nl-NL, EUR, geen decimalen
formatPercent(value)  // nl-NL, 2 decimalen, input decimaal (0.07 → 7,00%)
```

---

## Query-uitbreidingen (`assets.ts`)

| Functie | Doel |
|---|---|
| `getLiquidAssetsWithCalculations(userId)` | Liquide assets met netDeposit, unrealizedGain, XIRR per asset |
| `getMortgageBalancesMap(userId)` | Map `assetId → outstandingBalance` voor netto vermogen berekening |

---

## Bugs gevonden & opgelost

- Schema-kolom heet `outstanding_balance`, niet `balance` — gecorrigeerd in query en in vastgoed-pagina
- Recharts `Tooltip.formatter` en `labelFormatter` type mismatch — opgelost met runtime `typeof` check
- `recharts` niet geïnstalleerd (sprint zei "al geïnstalleerd") — alsnog geïnstalleerd via `npm install recharts`

---

## globals.css

Toegevoegd:
- `--color-chart-primary: #6E8F74`
- `--color-chart-secondary: #7B92B2`
- `--color-canvas`, `--color-text-primary`, `--color-text-secondary`

---

## Bestandslijst

**Nieuw:**
- `src/lib/utils/format.ts`
- `src/components/ui/KpiCard.tsx`
- `src/components/ui/ProgressBar.tsx`
- `src/components/vermogen/NetWorthChart.tsx`
- `src/components/vermogen/AssetTable.tsx`

**Gewijzigd:**
- `src/app/page.tsx` — homepage met echte data
- `src/app/vermogen/page.tsx` — volledig herbouwd
- `src/app/vastgoed/page.tsx` — volledig herbouwd
- `src/app/globals.css` — extra tokens
- `src/lib/db/queries/assets.ts` — twee nieuwe query-functies

---

## Verificatie

- 0 TypeScript fouten (`tsc --noEmit`)
- 43/43 Vitest tests groen
- Navigatie: `/`, `/vermogen`, `/vastgoed`, `/cashflow` (placeholder) beschikbaar

## Volgende sprint

Sprint 3.4 — Cashflow-pagina + allocatie-donut grafiek + benchmark-koppeling.
