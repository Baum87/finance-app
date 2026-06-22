# CLAUDE.md — Personal Finance App

Dit bestand instrueert Claude Code. Lees dit volledig voor je iets bouwt of wijzigt.

---

## Stack

- **Framework:** Next.js 16.2, App Router + RSC, Turbopack
- **Taal:** TypeScript strict mode — geen `any` zonder comment
- **Styling:** Tailwind v4 (CSS-first, `@theme` in globals.css) + shadcn/ui new-york
- **Database:** Supabase (PostgreSQL), Drizzle ORM
- **Auth:** Supabase Auth via `@supabase/ssr`
- **Charts:** Recharts
- **Geld:** `decimal.js` — **nooit JavaScript floating point voor geldbedragen**
- **Getallen in DB:** `numeric(15,2)` — nooit `float` of `real`
- **Testing:** Vitest (colocated bij `lib/finance/`)

---

## Architectuurregels (niet onderhandelbaar)

### 1. Server vs. Client Components
- Server Components zijn de **default**. Wordt pas `"use client"` bij: charts,
  formulieren, filters, browser-API's.
- Data fetching **uitsluitend in Server Components**, nooit in `useEffect`.
- Mutaties via **Server Actions**, geen losse API-routes.
- Houd de `"use client"`-grens zo laag mogelijk in de componentenboom.

### 2. Data-access
- Alle queries in `src/lib/db/queries/` — componenten importeren query-functies,
  schrijven nooit zelf inline Drizzle-queries.
- Drizzle voor CRUD en standaard queries. Raw SQL alleen voor zware aggregaties
  (CTE's, window functions) — altijd met comment waarom.
- Supabase JS client (`supabase.ts` / `supabase-server.ts`) uitsluitend voor auth.
  Database-queries lopen via Drizzle + `DATABASE_URL`.
- **Schakel de Data API (PostgREST) niet uit** — dat breekt supabase-js auth.
  Beveiliging loopt via RLS-policies en key-scheiding.

### 3. Geld & berekeningen
- **Nooit floating point** voor geldbedragen. Gebruik `decimal.js` in TS,
  `numeric(15,2)` in PostgreSQL.
- Finance-berekeningen draaien in `src/lib/finance/` — puur TypeScript,
  geen React, geen Drizzle, geen Supabase.
- `lib/finance` is de bron van waarheid voor XIRR, TWR, netto vermogen,
  vastgoedrendement, allocatie, passief inkomen.
- Rendementen als decimaal: `0.07` = 7%. UI vermenigvuldigt ×100 voor weergave.
- Afronding **uitsluitend bij weergave** (`format.ts`), nooit in tussenberekeningen.

### 4. XIRR vs. TWR — kritisch onderscheid
- **XIRR** = primair rendementsgetal voor de gebruiker. Toont timing-effect.
- **TWR** = uitsluitend voor benchmark-vergelijking. Zuivert timing eruit.
- Deze twee nooit mengen in één KPI of vergelijking. Zie finance-logic.md.

### 5. RLS
- RLS staat aan op **alle** user-gerelateerde tabellen.
- Elke query filtert expliciet op `userId` via de `tenant_users` join —
  extra laag bovenop RLS, niet als vervanging.
- `rls.sql` en `trigger.sql` staan in `src/lib/db/` en zijn versiebeheerd.
- `fx_rates` heeft geen RLS (gedeelde tabel zonder user-data).

### 6. Errors & validatie
- Finance-functies gooien een `Error` met duidelijke melding bij ongeldige input.
  Nooit stilletjes `NaN` of `0` teruggeven.
- Server Actions valideren input via Zod aan de rand.
- Geen silent failures op geld-paden.

---

## Mappenstructuur

```
src/
  app/
    (auth)/login/         # login pagina + actions
    assets/               # CRUD assets + transacties
    vermogen/             # beleggingen dashboard
    vastgoed/             # vastgoed dashboard
    cashflow/             # cashflow & passief inkomen
    layout.tsx
    page.tsx              # homepage / overzicht
  components/
    ui/                   # shadcn/ui — eigendom, niet regenereren
    assets/               # AssetForm, AssetList, TransactionForm, TransactionList
    vermogen/             # NetWorthChart, AssetTable, AllocationChart
    cashflow/             # PassiveIncomeBreakdown
    layout/               # Topbar
  lib/
    finance/              # puur TS — XIRR, TWR, net-worth, etc. + finance.test.ts
    db/
      schema.ts           # Drizzle schema — bron van waarheid
      index.ts            # Drizzle client (DATABASE_URL)
      supabase.ts         # Supabase browser client (auth only)
      supabase-server.ts  # Supabase server client (auth only)
      rls.sql             # RLS policies — versiebeheerd
      trigger.sql         # auth trigger — versiebeheerd
      queries/            # assets.ts, cashflow.ts, seed.ts
    services/             # prices.ts (yahoo-finance2), benchmark.ts (URTH TWR)
    utils/
      format.ts           # formatCurrency, formatPercent (nl-NL)
  types/
    index.ts              # AssetType, TransactionType, Money, DateString
```

---

## Naamgeving

| Wat | Conventie | Voorbeeld |
|---|---|---|
| Bestanden (componenten) | PascalCase | `AssetTable.tsx` |
| Bestanden (overig) | kebab-case | `net-worth.ts` |
| DB-tabellen | snake_case, meervoud | `transactions` |
| DB-kolommen | snake_case | `purchase_price` |
| Booleans | is/has-prefix | `isRental`, `hasHypothek` |
| Constanten | UPPER_SNAKE | `DEFAULT_BENCHMARK` |

Engels voor code en schema. Nederlands mag in UI-teksten en comments.

---

## Designsysteem (kort)

- Achtergrond pagina: `--color-canvas: #F7F6F3`
- Kaarten: `--color-card: #FFFFFF`, border `--color-border: #ECEAE5`, radius 24px
- Primaire actie: `--color-sage: #6E8F74`
- Negatief: `--color-terracotta: #C97A6B` (nooit standaard rood)
- Grafieken: max 2 kleuren, sage primair, blauw `#7B92B2` secundair
- Geen schaduwen op kaarten. Geen gradients.
- Font: Inter. Grote bedragen: `font-semibold`.
- Geen zijbalk. Topbar is de enige navigatie. Max-width 1200px.

Volledige spec: `docs/frontend.md`

---

## Commands beschikbaar (`.claude/commands/`)

- `/review` — volledige code-review langs 6 dimensies
- `/new-component` — nieuw component aanmaken volgens conventies
- `/new-migration` — nieuwe Drizzle-migratie aanmaken

---

## Wat je NOOIT doet

- Float gebruiken voor geldbedragen
- `NaN` of `0` teruggeven bij finance-fouten (gooi een Error)
- Drizzle-query schrijven buiten `lib/db/queries/`
- `"use client"` toevoegen zonder dat het echt nodig is
- XIRR en TWR door elkaar gebruiken in dezelfde KPI
- RLS uitschakelen of omzeilen
- De Data API (PostgREST) uitschakelen
- Bestanden aanmaken buiten de beschreven mappenstructuur
