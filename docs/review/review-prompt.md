# Codebase Review — Finance App

## Doel van deze taak

Voer een grondige audit uit van de huidige codebase tegen de projectdocumenten. Rapporteer **alleen afwijkingen en ontbrekende implementaties** — geen bevestiging van wat al correct is. Het eindresultaat is een gestructureerde lijst van problemen gesorteerd op prioriteit.

---

## Stap 1 — Lees eerst alle projectdocumenten

Lees de volgende bestanden volledig voordat je ook maar één regel code bekijkt:

```
docs/data-model.md
docs/finance-logic.md
docs/conventions.md
docs/frontend.md
docs/context.md
docs/architecture.md
docs/decisions.md
```

Deze documenten zijn de **bron van waarheid**. De code is de implementatie die daaraan getoetst wordt, niet andersom.

---

## Stap 2 — Audit de codebase op de volgende punten

### 2A — Database coverage: zijn alle tabellen bereikbaar via de UI?

Loop door `src/lib/db/schema.ts` en check voor elke tabel:
- Is er een query-functie in `src/lib/db/queries/`?
- Is er een UI-formulier om data in te voeren (create) en te bekijken (read)?
- Is er een Server Action voor mutaties?

Tabel voor tabel controleren:
- `tenants`, `tenant_users`, `users` — infrastructuur, geen UI nodig
- `assets` — CRUD aanwezig?
- `transactions` — CRUD aanwezig?
- `asset_valuations` — **create en read aanwezig?** Dit is kritisch voor vastgoed, pensioen en spaargeld
- `stock_etf_details`, `crypto_details`, `savings_details`, `pension_details`, `real_estate_details` — worden deze correct aangemaakt en bijgewerkt via `AssetForm`?
- `mortgages` — aanmaken via `AssetForm`?
- `mortgage_balances` — **create aanwezig?** Handmatig bijwerken van hypotheeksaldo is vereist
- `liabilities` — CRUD aanwezig?
- `fx_rates` — wordt dit gevuld? (handmatig of via service)
- `asset_tax_metadata` — aanmaken bij asset create?

### 2B — Finance-functies: kloppen de implementaties met `finance-logic.md`?

Lees elk bestand in `src/lib/finance/` en vergelijk de implementatie met het contract in `docs/finance-logic.md`. Check per functie:

- **Functie-interface**: kloppen de parameter-namen en -types met de spec?
- **Cashflow-conventie XIRR** (sectie 6): zijn `buy`, `deposit`, `cost` negatief en `sell`, `withdrawal`, `dividend`, `interest`, `rental_income` positief?
- **Sluitcashflow**: wordt bij open posities een sluitcashflow toegevoegd met de huidige waarde?
- **Randgevallen**: worden de gespecificeerde errors gegooid (< 2 cashflows, geen gemengde tekens, geen convergentie)?
- **Netto inleg** (sectie 1): tellen `dividend`, `interest`, `rental_income` en `cost` **niet** mee als inleg?
- **Vastgoedrendement** (sectie 10): kloppen `grossYield`, `netYield`, `cashOnCash`, `ltv` met de formules?
- **TWR** (sectie 7): wordt er gerekend met groeifactoren, niet met percentages?
- **Benchmark** (sectie 8): is `outperformance = portfolio_twr − benchmark_twr`?

Voer de testcases uit `finance-logic.md` handmatig na op de implementatie (niet uitvoeren, maar de logica doorlopen). Rapporteer elke afwijking.

### 2C — Geldrepresentatie: nergens floating point

Zoek in de gehele codebase (`src/`) naar:
- Direct gebruik van `parseFloat()` of `Number()` op geldbedragen
- Rekenoperaties (`+`, `-`, `*`, `/`) op `string`-bedragen zonder `decimal.js`
- Bedragen die als `number` worden doorgegeven aan finance-functies zonder Decimal-omzetting
- Plekken waar `numeric`-waarden uit de DB direct worden gebruikt in berekeningen zonder Decimal-wrapper

Verwacht patroon: alle geldbedragen via `decimal.js` (`new Decimal(value)`). Afwijkingen zijn kritische bugs.

### 2D — Conventions: code-stijl en architectuur

Check de volgende punten uit `conventions.md`:

- **`"use client"` grens**: zijn er Client Components die data fetchen via `useEffect` in plaats van in een Server Component?
- **Queries in componenten**: schrijven componenten inline Drizzle-queries, of roepen ze altijd een query-functie aan uit `lib/db/queries/`?
- **Server Actions**: zijn alle mutaties via Server Actions, of zijn er losse API-routes (`app/api/`) aangemaakt?
- **Naamgeving**: zijn component-bestanden PascalCase, overige bestanden kebab-case?
- **`any` types**: zijn er `any`-types zonder comment?
- **Drizzle als bron van waarheid**: zijn er handmatig gedefinieerde types die de Drizzle-schema-types dupliceren?

### 2E — Frontend: kloppen de pagina's met `frontend.md`?

Vergelijk de gebouwde pagina's met de specs in `frontend.md`:

- **Overzicht (`/`)**: bevat de pagina de vier blokken (Hero, Inzichtkaart, Actief doel, AI Coach placeholder)?
- **Vermogen (`/vermogen`)**: drie KPI-cards (Totaal vermogen, Rendement dit jaar, vs. Benchmark) + grafiek + asset-tabel?
- **Vastgoed (`/vastgoed`)**: per object de juiste KPI-cards (zie sectie 3 in `frontend.md`)?
- **Cashflow (`/cashflow`)**: twee KPI-cards + PassiveIncomeBreakdown + NetWorthChart?
- **Kleurpalet**: worden de CSS-variabelen uit `frontend.md` gebruikt, of zijn er hardcoded hex-waarden in componenten?
- **Lege staten**: hebben alle lijsten en pagina's een lege staat met een uitnodigende CTA?
- **Negatieve getallen**: worden negatieve waarden in `--color-terracotta` getoond, nooit in standaard rood?

### 2F — RLS en beveiliging

- Heeft elke user-gerelateerde tabel een RLS-policy in `src/lib/db/rls.sql`?
- Filteren alle query-functies expliciet op `userId` (naast de RLS-laag)?
- Zijn er plekken waar `user_id` niet wordt meegegeven aan een query die dat wel vereist?

---

## Stap 3 — Rapportage

Geef de output als een gestructureerde Markdown-lijst met drie prioriteitsniveaus:

### 🔴 Kritiek — breekt functionaliteit of data-integriteit
Dingen die ervoor zorgen dat de app niet correct werkt of financiële data verkeerd berekent.

### 🟡 Belangrijk — ontbrekende features of afwijkingen van spec
Dingen die in de spec staan maar niet zijn gebouwd, of die afwijken van de contracten in de projectdocumenten.

### 🟢 Aandachtspunt — technische schuld of stijlafwijking
Conventies die niet gevolgd worden, maar geen directe functionele impact hebben.

---

Per bevinding het volgende format:

```
**[Categorie] Korte omschrijving**
Bestand: `pad/naar/bestand.ts` (regel X indien van toepassing)
Verwacht (volgens doc): ...
Gevonden: ...
```

---

## Wat je NIET hoeft te doen

- Geen fixes uitvoeren — alleen rapporteren
- Geen bevestiging van wat correct is
- Geen uitleg van hoe de app werkt
- Geen suggesties voor nieuwe features

Het resultaat van deze taak is uitsluitend een prioriteitenlijst van afwijkingen.
