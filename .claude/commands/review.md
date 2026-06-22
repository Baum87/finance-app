# /review — Code Review

Voer een volledige review uit langs deze 6 dimensies. Rapporteer per dimensie:
bevindingen, ernst (kritiek / waarschuwing / suggestie), en de aanbevolen fix.

## Dimensie 1 — Database-dekking
Controleer of elke tabel uit `src/lib/db/schema.ts` een werkende UI-flow heeft:
- Kunnen records aangemaakt worden via een formulier?
- Ontbreekt er een formulier voor `asset_valuations` of `mortgage_balances`?
- Zijn alle query-functies in `queries/` volledig en type-safe?

## Dimensie 2 — Finance-correctheid
Controleer `src/lib/finance/` op:
- Gebruikt elke geldbedrag-berekening `decimal.js`? Nooit `number` optellen voor geld.
- Is XIRR uitsluitend gebruikt als primair rendementsgetal (niet voor benchmark)?
- Is TWR uitsluitend gebruikt voor benchmark-vergelijking?
- Worden rendementen consequent als decimaal doorgegeven (0.07, niet 7)?
- Gooien alle functies een `Error` bij ongeldige input?

## Dimensie 3 — Floating point
Scan alle bestanden op floating-point risico's:
- Zoek op `parseFloat`, `Number()`, `+someString`, directe optelling van `amount`-velden.
- Check of `decimal.js` consistent gebruikt wordt waar het moet.
- Check DB-schema: zijn alle geldbedragen `numeric(15,2)` en geen `real` of `float`?

## Dimensie 4 — Codestijl & conventies
- Zijn er `"use client"` componenten die server-side zouden kunnen?
- Zijn er inline queries buiten `lib/db/queries/`?
- Zijn er `any`-types zonder comment?
- Volgen bestandsnamen de PascalCase/kebab-case conventie?

## Dimensie 5 — Frontend-spec
Controleer elke pagina (`/`, `/vermogen`, `/vastgoed`, `/cashflow`) tegen `docs/frontend.md`:
- Kloppen de KPI-cards met de spec?
- Worden de juiste kleuren gebruikt (sage voor positief, terracotta voor negatief)?
- Zijn lege staten geïmplementeerd?
- Worden bedragen geformatteerd via `formatCurrency` uit `lib/utils/format.ts`?

## Dimensie 6 — RLS & beveiliging
- Heeft elke user-gerelateerde tabel een RLS-policy in `rls.sql`?
- Filtert elke query-functie expliciet op `userId` via `tenant_users`?
- Staat de publishable key uitsluitend client-side, secret key alleen server-side?
- Is `fx_rates` de enige tabel zonder RLS?
