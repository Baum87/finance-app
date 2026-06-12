# Sprint 3.4 — Allocatiedonut, Benchmark & Inzichten

**Datum:** 12 juni 2026
**Status:** Afgerond

---

## Wat is gebouwd

### Taak 1 — Cashflow pagina (afgerond in vorige sessie)

**`src/lib/db/queries/cashflow.ts`** (nieuw)
- `getPassiveIncomeData(userId, from, to)` — alle dividend/rente/huur/kosten in periode
- `getNetWorthAtDate(userId, date)` — netto vermogen op historische datum via stored valuations + hypotheeksaldo's; `null` als geen data
- `getPortfolioTxDates(userId, from, to)` — unieke transactiedatums voor benchmark subperioden

**`src/components/cashflow/PassiveIncomeBreakdown.tsx`** (nieuw)
- Horizontale bars: breedte = waarde/max × 100%
- Kleur `--color-chart-primary` (sage)
- Empty state als alles nul

**`src/app/cashflow/page.tsx`** (herbouwd)
- KPI: passief inkomen YTD + netto vermogengroei YTD
- PassiveIncomeBreakdown component
- NetWorthChart hergebruikt van Sprint 3.3

---

### Taak 2 — Allocatiedonut

**`src/components/vermogen/AllocationChart.tsx`** (nieuw, `"use client"`)
- Recharts `<PieChart>` met `<Pie innerRadius={60} outerRadius={100}>`
- Max 4 segmenten: vastgoed + pensioen samenvoegen als beide < 5%
- Kleuren: sage `#6E8F74`, blauw `#7B92B2`, amber `#D4A05D`, terracotta `#C97A6B`
- Centerabel: grootste categorie naam + percentage
- Legenda onder de donut
- Data van `calculateAllocation()` uit `@/lib/finance`
- Toegevoegd onder de asset-tabel in `/vermogen`

---

### Taak 3 — URTH Benchmark

**`src/lib/services/benchmark.ts`** (nieuw)
- `getBenchmarkTwr(from, to)` — URTH ETF historische koersen via `getHistoricalPrices()`
- Berekent TWR via `calculateTwr()` over dagelijkse sub-perioden
- Geeft `null` terug bij netwerk-/datafout

**`src/app/vermogen/page.tsx`** (bijgewerkt)
- Benchmark-KPI-card: excess return (XIRR portfolio − URTH TWR) + sage/terracotta trend
- Subtext toont URTH-benchmark waarde als referentie

---

### Taak 4 — Homepage inzichtkaart

**`src/app/page.tsx`** (bijgewerkt)
- Blok 3 "Actief doel" vervangen door "Inzicht" kaart
- Template-tekst: grootste allocatiecategorie + % + vermogensgroei t.o.v. 30 dagen geleden
- Berekent via `calculateAllocation()` + `getNetWorthAtDate()` (−30 dagen)
- Fallback: "Voeg assets en waarderingen toe om inzichten te zien."

---

## Technische keuzes

- **AllocationChart CenterLabel**: SVG `<text>` met twee `<tspan>` elementen — werkt direct in Recharts zonder extra library
- **Benchmark URTH**: bewuste keuze voor MSCI World ETF (URTH) als globale marktbenchmark; geen eigen historische koersen opslaan
- **getBenchmarkTwr**: altijd `.catch(() => null)` in de pagina — externe API-uitval breekt de pagina niet
- **Inzichtkaart**: puur template-based in v1; AI-analyse volgt later

---

## Bestanden gewijzigd / aangemaakt

| Bestand | Status |
|---|---|
| `src/components/vermogen/AllocationChart.tsx` | Nieuw |
| `src/lib/services/benchmark.ts` | Nieuw |
| `src/lib/db/queries/cashflow.ts` | Nieuw |
| `src/components/cashflow/PassiveIncomeBreakdown.tsx` | Nieuw |
| `src/app/cashflow/page.tsx` | Herbouwd |
| `src/app/vermogen/page.tsx` | Uitgebreid (benchmark + allocatie) |
| `src/app/page.tsx` | Uitgebreid (inzichtkaart) |

---

## Volgende sprint

Sprint 3.5 (of 4.x): doelenstelling, FIRE-calculator, of verdere AI-coaching.
