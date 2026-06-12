# Audit Rapport — Finance App

**Datum:** 12 juni 2026
**Status:** Gedeeltelijk opgelost (zie notities per bevinding)

---

## 🔴 Kritiek — breekt functionaliteit of data-integriteit

**[Schema] `is_liquid` kolom ontbreekt in `assets` tabel**
Bestand: `src/lib/db/schema.ts`
Verwacht: `is_liquid BOOLEAN NOT NULL DEFAULT true` conform data-model.md
Gevonden: workaround via hardcoded `LIQUID_TYPES`-array in `assets.ts`
**✅ Opgelost:** kolom toegevoegd aan schema; `createAsset` zet `isLiquid` op basis van asset type

---

**[Schema] `fees` kolom ontbreekt op `transactions`**
Bestand: `src/lib/db/schema.ts`
Verwacht: `fees NUMERIC(15,2) NOT NULL DEFAULT 0` — nodig voor correcte kostprijs (AVCO)
Gevonden: `calculateCostBasis` gebruikt alleen `tx.amount`; fees worden genegeerd, kostprijs is structureel te laag
**✅ Opgelost:** kolom toegevoegd aan schema (migratie `0001_clear_groot.sql`); fee-integratie in AVCO-berekening is Sprint 4 taak

---

**[Finance] XIRR — `cost`-transacties ontbreken in cashflows**
Bestand: `src/lib/db/queries/assets.ts`, `src/app/vastgoed/page.tsx`
Verwacht: `cost` = negatieve cashflow conform finance-logic.md §6
Gevonden: alleen `buy/sell/deposit/withdrawal` meegenomen; `cost` ontbreekt
**✅ Opgelost:** alle cashflow-types conform spec verwerkt (`buy/deposit/cost` = negatief, `sell/withdrawal/dividend/interest/rental_income` = positief)

---

**[Finance] XIRR — geen Error bij alle cashflows zelfde teken**
Bestand: `src/lib/finance/xirr.ts`
Verwacht: `Error('XIRR requires mixed cashflows')` conform spec
Gevonden: check ontbreekt; Newton-Raphson convergeert naar willekeurige waarde
**✅ Opgelost:** mixed-signs check toegevoegd vóór Newton-Raphson

---

**[Database] Geen create-pad voor `asset_valuations`**
Verwacht: `createValuation` + server action + formulier voor spaarrekening/vastgoed/pensioen
Gevonden: alleen read — gebruiker kon huidige waarde niet invoeren → waarde toonde €0
**✅ Opgelost:** `ValuationForm` + `createValuationAction` toegevoegd (commit `4bbe6be`)

---

**[Database] Geen create-pad voor `mortgage_balances`**
Verwacht: `createMortgageBalance` + server action + formulier
Gevonden: saldo werd nooit geschreven → LTV en netto vermogen altijd onjuist
**✅ Opgelost:** `MortgageBalanceForm` + `createMortgageBalanceAction` toegevoegd (commit `4bbe6be`)

---

**[Database] Geen UI of server actions voor `liabilities`**
Verwacht: CRUD voor niet-vastgoed schulden (studentenlening, persoonlijke lening)
Gevonden: tabel bestaat maar geen queries, actions of UI; netto vermogen mist schulden

---

**[Database] `asset_tax_metadata` wordt nooit aangemaakt bij `createAsset`**
Bestand: `src/lib/db/queries/assets.ts`
Verwacht: record aanmaken in dezelfde transactie conform data-model.md
Gevonden: geen INSERT in `createAsset`
**✅ Opgelost:** `assetTaxMetadata` insert toegevoegd aan einde van `createAsset` transactie (box 3 default)

---

**[Finance] TWR — `beginValue = 0` gooit Error i.p.v. `Rp = 0`**
Bestand: `src/lib/finance/twr.ts` (r. 22)
Verwacht: spec §7 — eerste sub-periode begint op stortingsdatum; Rp = 0
Gevonden: `throw new Error(...)` — tegengesteld aan de spec
**✅ Opgelost:** `startValue = 0` → sub-periode overgeslagen (neutraal); lege periodes → return `0`

---

**[Auth] Geen tenant aangemaakt bij registratie als trigger.sql ontbrak**
Bestand: `src/lib/db/queries/` — alle query-bestanden
Gevonden: gebruikers zonder `tenant_users` record konden niets opslaan of ophalen
**✅ Opgelost:** `getOrCreateTenant()` helper aangemaakt die tenant-chain auto-aanmaakt (commit `6804b96`)

---

## 🟡 Belangrijk — ontbrekende features of spec-afwijkingen

**[Frontend] Homepage Blok 2 wijkt af van spec**
Bestand: `src/app/page.tsx`
Verwacht: één inzichtkaart met netto vermogen delta + twee bulletpoints + ghost-knop "Bekijk details"
Gevonden: `KpiCard` zonder delta en apart tekstblok — verkeerde structuur

---

**[Frontend] Homepage mist "Actief doel" blok**
Verwacht: vier blokken: Hero, Inzichtkaart, Actief doel (met voortgangsbalk), AI Coach
Gevonden: "Actief doel" verwijderd in Sprint 3.4; doelen-datamodel bestaat niet

---

**[Frontend] Navigatie miste link naar `/assets` (Portfolio)**
Bestand: `src/components/layout/Topbar.tsx`
Gevonden: gebruiker kon niet navigeren naar assets-pagina of assets toevoegen
**✅ Opgelost:** "Portfolio" toegevoegd aan navItems (commit `f15e122`)

---

**[Finance] `calculateCashOnCash` gebruikt verkeerde noemer**
Bestand: `src/app/vastgoed/page.tsx` (r. 140–145)
Verwacht: `eigen_inleg = purchase_price + purchase_costs − hypotheek_origineel_bedrag`
Gevonden: `initialInvestment = purchasePrice + purchaseCosts` (zonder hypotheekaftrek) → rendement te laag
**✅ Opgelost:** `initialInvestment` berekend als `purchasePrice + purchaseCosts − mortgageOriginal`

---

**[Finance] XIRR YTD mist openingscashflow op 1 jan**
Bestand: `src/app/vermogen/page.tsx`
Verwacht: portfolio-waarde op 1 jan als negatieve openingscashflow
Gevonden: alleen transacties ≥ ytdStart — structureel onjuist voor assets van vóór huidig jaar

---

**[Frontend] NetWorthChart bevat geen hypotheeksaldi**
Bestand: `src/app/cashflow/page.tsx`, `src/app/vermogen/page.tsx`
Verwacht: netto vermogen = assets minus schulden per datum
Gevonden: `liability: new Decimal(0)` hardcoded → grafiek toont bruto asset-waarden
**✅ Opgelost:** `getMortgageBalanceTimeSeries()` toegevoegd; per valuatiepunt wordt het meest recente hypotheeksaldo gezocht en als liability meegegeven aan `buildNetWorthSeries`

---

**[Finance] XIRR voor vastgoed mist `deposit`-cashflows**
Bestand: `src/app/vastgoed/page.tsx`
Gevonden: `deposit` en `withdrawal` worden genegeerd bij XIRR-berekening voor verhuurpand
**✅ Opgelost:** alle cashflow-types meegenomen in vastgoed XIRR

---

**[Finance] `grossYield` nergens in de UI aangeroepen**
Verwacht: bruto huurrendement tonen op vastgoed-detailkaart
Gevonden: `calculateGrossRentalYield` bestaat in `lib/finance` maar wordt niet gebruikt in de UI
**✅ Opgelost:** bruto huurrendement KPI-kaart toegevoegd aan verhuurpand sectie (4-koloms grid)

---

**[Convention] Inline Drizzle-queries in Server Components**
Bestand: `src/app/vermogen/page.tsx`, `src/app/cashflow/page.tsx`
Verwacht: queries altijd via `lib/db/queries/`
Gevonden: directe `db`-imports en inline queries in pagina-bestanden
**✅ Opgelost:** `getValuationTimeSeries()` toegevoegd aan `cashflow.ts`; `getTransactionsByAssets()` toegevoegd aan `transactions.ts`; inline queries verwijderd uit beide pagina-bestanden

---

**[Schema] Ontbrekende kolommen in `mortgages`**
Verwacht: `interest_rate_fixed_until`, `is_active`, `updated_at` conform data-model.md
Gevonden: ontbreken in Drizzle-schema
**✅ Opgelost:** alle drie kolommen toegevoegd aan schema (migratie `0001_clear_groot.sql`)

---

**[Schema] `liabilities.is_active` ontbreekt**
Verwacht: `is_active BOOLEAN NOT NULL DEFAULT true` conform data-model.md
Gevonden: kolom ontbreekt in Drizzle-schema
**✅ Opgelost:** kolom toegevoegd (migratie `0001_clear_groot.sql`)

---

**[Finance] TWR — geen sub-periodes moet `0` teruggeven, niet een Error**
Bestand: `src/lib/finance/twr.ts`
Verwacht: finance-logic.md — "Geen sub-periodes → TWR = 0"
Gevonden: `throw new Error('Minimaal één periode vereist voor TWR')`

---

**[Finance] XIRR convergentiedrempel wijkt af van spec**
Bestand: `src/lib/finance/xirr.ts`
Verwacht: `|NPV(r)| < 1e-7` conform finance-logic.md
Gevonden: `TOLERANCE = 1e-8` op de rate-delta, niet op NPV
**✅ Opgelost:** drempel gewijzigd naar `|NPV(r)| < NPV_TOLERANCE (1e-7)`, check vóór Newton-stap

---

## 🟢 Aandachtspunt — technische schuld of stijlafwijking

**[Convention] Hardcoded hex-kleuren in Recharts-componenten**
Bestand: `src/components/vermogen/NetWorthChart.tsx`, `src/components/vermogen/AllocationChart.tsx`
Gevonden: `#6E8F74`, `#6B7280`, `#161616` etc. hardcoded — gebruik CSS-variabelen waar mogelijk
**✅ Opgelost:** kleuren gecentraliseerd in `src/lib/utils/chart-colors.ts` (`CHART_COLORS`, `CHART_PALETTE`, `CHART_STYLE`)

---

**[Convention] `Number()` op geldbedrag in `TransactionList.tsx`**
Gevonden: directe `Number(amount)` i.p.v. `new Decimal(amount).toNumber()`
**✅ Opgelost:** vervangen door `new Decimal(amount).toNumber()`

---

**[Convention] Legenda-box in `AllocationChart` verboden per frontend.md**
Bestand: `src/components/vermogen/AllocationChart.tsx`
Verwacht: geen legenda-box — tooltip-only of directe labels
Gevonden: rij met gekleurde bolletjes en labels onder de donut
**✅ Opgelost:** legenda-sectie verwijderd; donut is nu tooltip-only

---

**[Convention] Drie kopieën van `getTenantId` helper**
Gevonden: dubbele implementaties in `assets.ts`, `cashflow.ts`, `vermogen/page.tsx`
**✅ Opgelost:** vervangen door gedeelde `getOrCreateTenant()` (commit `6804b96`)

---

**[Convention] RLS mist DELETE-policies op `asset_valuations` en detail-tabellen**
Bestand: `src/lib/db/rls.sql`
Gevonden: geen DELETE-policy op `asset_valuations` en type-specifieke detail-tabellen
**✅ Opgelost:** DELETE-policies toegevoegd voor `asset_valuations`, alle detail-tabellen, `mortgages`, `mortgage_balances`, en `asset_tax_metadata`

---

**[Convention] `tenant_users.joined_at` heet `createdAt` in schema**
Verwacht: `joined_at` conform data-model.md
Gevonden: kolom heet `createdAt` in het Drizzle-schema
**✅ Opgelost:** kolom hernoemd naar `joined_at` in schema; migratie `0002_rename_joined_at.sql`

---

## Samenvatting opgeloste items

| Commit | Fix |
|---|---|
| `f15e122` | Portfolio-link toegevoegd aan navigatie |
| `4bbe6be` | `ValuationForm` + `MortgageBalanceForm` + server actions |
| `6804b96` | `getOrCreateTenant()` — auto-aanmaken tenant bij ontbrekende registratie |
| `1b9af0c` | TWR: lege periodes → 0, startValue=0 → overslaan |
| `1b9af0c` | XIRR: mixed-signs check, alle cashflow-types conform spec |
| `1b9af0c` | cashOnCash noemer: eigen inleg = aankoopprijs + kosten − hypotheek |
| `1b9af0c` | `asset_tax_metadata` aanmaken bij createAsset |
| `1b9af0c` | `Number()` → `new Decimal().toNumber()` in TransactionList |
| `1b9af0c` | `"use client"` toegevoegd aan AssetList en TransactionList |
