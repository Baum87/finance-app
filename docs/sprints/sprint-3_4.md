# Sprint 3.4 — Cashflow, allocatie & benchmark

## Context voor Claude Code

Je werkt aan een persoonlijke finance-app gebouwd met Next.js 16.2 (App Router), Supabase, Drizzle ORM en Tailwind CSS v4 + shadcn/ui (`base-nova` preset). Lees `CLAUDE.md` voor stack, conventies en naamgeving.

**Wat er al staat na Sprint 3.3:**
- `/` — Overzicht met netto vermogen, placeholder doel en AI Coach
- `/vermogen` — KPI-cards, nettovermogen-grafiek (`buildNetWorthSeries`), asset-tabel met XIRR
- `/vastgoed` — Per object eigen woning / verhuur met LTV, cashflow-tabel
- `/cashflow` — bestaat als placeholder, nog leeg
- Finance engine volledig: `calculateXirr`, `calculateTwr`, `calculateNetWorth`, `calculatePassiveIncome`, `calculateAllocation`, `buildNetWorthSeries`, etc.
- `formatCurrency` en `formatPercent` in `src/lib/utils/format.ts`
- `KpiCard` en `ProgressBar` in `src/components/ui/`

---

## Doel van deze sprint

Vier losse, onafhankelijke taken. Voer ze in volgorde uit.

---

## Taak 1 — Cashflow-pagina (`/cashflow`)

**Route:** `src/app/cashflow/page.tsx` — Server Component

### Bovenaan: twee KPI-cards naast elkaar

```
┌─────────────────────┐  ┌─────────────────────┐
│ Passief inkomen     │  │ Netto vermogen       │
│ dit jaar            │  │ groei dit jaar       │
│ €10.330             │  │ +€18.500             │
└─────────────────────┘  └─────────────────────┘
```

- **Passief inkomen dit jaar:** gebruik `calculatePassiveIncome()` met `from = 1 jan huidig jaar`, `to = vandaag`. Toon `netPassiveIncome`.
- **Netto vermogen groei dit jaar:** `netWorth(vandaag) − netWorth(1 jan huidig jaar)`. Gebruik `calculateNetWorth()` twee keer. Toon als bedrag met `+`/`−` prefix. Kleur via `trend` prop op `KpiCard`.

### Midden: passief inkomen breakdown

**`src/components/cashflow/PassiveIncomeBreakdown.tsx`** (Server Component):

Drie horizontale balken (geen taartdiagram — balken zijn eerlijker voor vergelijking):
- Dividend
- Rente
- Huur (netto = `rentalIncome − rentalCosts`)

Elke balk: label links, bedrag rechts, balk ertussenin. Breedte = `waarde / max(drie waarden) × 100%`. Kleur `--color-chart-primary`. Als alle drie nul zijn: lege staat tonen.

### Onder: nettovermogen tijdlijn

Hergebruik `NetWorthChart` uit Sprint 3.3 (importeer uit `src/components/vermogen/NetWorthChart.tsx`). Data via `buildNetWorthSeries()`.

Optioneel: tweede lijn als er een doel bestaat — sla dit deel over in deze sprint, laat een comment achter waar de tweede lijn later in komt.

### Benodigde queries

Voeg toe aan `src/lib/db/queries/assets.ts` of maak `src/lib/db/queries/cashflow.ts`:

- `getPassiveIncomeData(userId, from, to)` — haalt alle transacties op van type `dividend`, `interest`, `rental_income`, `cost` in de periode, mapped naar `{ amount, date, type }` voor `calculatePassiveIncome()`
- `getNetWorthAtDate(userId, date)` — berekent netto vermogen op een specifieke peildatum (hergebruik logica uit homepage, maar met datum-parameter)

---

## Taak 2 — Allocatie-donut op `/vermogen`

**Bestand:** `src/components/vermogen/AllocationChart.tsx` (`"use client"`)

Voeg toe aan de `/vermogen` pagina, onder de asset-tabel.

### Specificaties

- Recharts `<PieChart>` met `<Pie innerRadius={60} outerRadius={100}>`
- Maximaal 4 segmenten: de 5 asset-types, maar vastgoed en pensioen samenvoegen onder "Vastgoed & Pensioen" als ze samen < 5% zijn — anders apart tonen
- Kleuren: gebruik `--color-sage`, `--color-blue`, `--color-amber`, `--color-terracotta` voor de segmenten (in die volgorde)
- Geen legenda-box — label de segmenten direct via `<Label>` in het midden: grootste categorie + percentage
- Tooltip: `formatCurrency` voor waarde + `formatPercent` voor percentage
- Data: gebruik `calculateAllocation()` met de al opgehaalde `assetsWithValues`

### Sectietitel boven de donut

Klein, secundair (`text-sm text-muted-foreground`): **Allocatie**

---

## Taak 3 — Benchmark-vergelijking op `/vermogen`

Vul de "vs. Benchmark" KPI-card in die nu "—" toont.

### Aanpak

- Gebruik `yahoo-finance2` (al geïnstalleerd) om historische koersen op te halen van `'URTH'` (iShares MSCI World ETF — bruikbaar als proxy; de MSCI World index heeft geen directe Yahoo Finance ticker)
- Periode: 1 jan huidig jaar t/m vandaag
- Bereken TWR van de benchmark over dezelfde sub-periodes als het portfolio (gebruik de cashflow-datums van de gebruiker als sub-periode-grenzen)
- Bereken `calculateExcessReturn(portfolioTwr, benchmarkTwr)`
- Toon in KPI-card: `+1,2%` of `−0,8%` met trend-kleur

**Fallback:** als de koersdata niet opgehaald kan worden (netwerk, ongeldige ticker), toon "—" met een `title`-attribuut "Benchmarkdata niet beschikbaar". Gooi nooit een error naar de pagina.

### Nieuwe service

**`src/lib/services/benchmark.ts`** — functie `getBenchmarkTwr(userId, from, to)`:

1. Haal portfolio-cashflow-datums op (sub-periode-grenzen)
2. Haal historische koersen op voor `URTH` via `getHistoricalPrices()`
3. Bouw `TwrSubPeriod[]` op basis van benchmark-koersen op die datums
4. Geef `calculateTwr()` resultaat terug, of `null` bij fout

---

## Taak 4 — Overzicht-pagina: "Belangrijkste inzicht" kaart

Vul het tweede blok in op de homepage (`src/app/page.tsx`) — nu een placeholder.

### Logica (server-side)

1. Bereken netto vermogen vorige maand (1e van vorige maand) en vandaag
2. Bereken het verschil per asset-categorie
3. Toon de categorie met de grootste absolute verandering als "belangrijkste inzicht"

### Layout

```
┌──────────────────────────────────────┐
│ Aandelen & ETF's stegen het meest    │  ← gegenereerde tekst
│                                      │
│ • +€1.240 in marktwaarde             │  ← twee bulletpoints
│ • VWRL is je grootste positie        │
│                                      │
│                        Bekijk →      │  ← ghost knop naar /vermogen
└──────────────────────────────────────┘
```

Hardcode de tekst-templates in een map per asset-type — geen AI-call in deze sprint:

```ts
const insights: Record<AssetType, (delta: number, topAssetName: string) => string> = {
  stock_etf: (delta, name) => `Aandelen & ETF's ${delta > 0 ? 'stegen' : 'daalden'} het meest`,
  crypto:    (delta, name) => `Crypto ${delta > 0 ? 'steeg' : 'daalde'} het meest`,
  savings:   (delta, name) => `Spaargeld groeide het meest`,
  real_estate: (delta, name) => `Vastgoed ${delta > 0 ? 'steeg' : 'daalde'} het meest in waarde`,
  pension:   (delta, name) => `Pensioenopbouw veranderde het meest`,
}
```

Lege staat: als er nog geen assets zijn, toon "Voeg assets toe om inzichten te zien."

---

## Wat bewust buiten scope blijft

| Element | Reden |
|---|---|
| Doelen/targets opslaan | Geen tabel voor in v1 — placeholder blijft staan |
| Notificaties | Sprint 4.3 |
| CSV-import | Sprint 4.1 |
| AI-inzichten | Fase 4 |

---

## Verificatie

Na afloop moet gelden:

- `tsc --noEmit` → 0 errors
- `npm run test` → alle bestaande 43 tests nog groen
- `/cashflow` toont passief inkomen breakdown en nettovermogen-tijdlijn met echte data
- `/vermogen` toont werkende allocatie-donut en benchmark-card (of graceful fallback bij netwerk-fout)
- `/` toont de "Belangrijkste inzicht" kaart met gegenereerde tekst

---

## Bestandslijst (verwacht nieuw/gewijzigd)

**Nieuw:**
- `src/components/cashflow/PassiveIncomeBreakdown.tsx`
- `src/components/vermogen/AllocationChart.tsx`
- `src/lib/services/benchmark.ts`
- `src/lib/db/queries/cashflow.ts` *(of uitbreiding van `assets.ts`)*

**Gewijzigd:**
- `src/app/cashflow/page.tsx` — volledig uitgebouwd
- `src/app/vermogen/page.tsx` — allocatiegrafiek + werkende benchmark-card
- `src/app/page.tsx` — "Belangrijkste inzicht" kaart ingevuld
