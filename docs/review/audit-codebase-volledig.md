# Codebase-audit — Finance App (volledig)

Reviewdatum: 2026-08-25
Reviewer: Claude Code (frisse blik, geen voorkennis van het project)
Codebase commit: `b5cd0a1` (working tree bevat ongecommitte wijzigingen, zie `git status`)
Methode: statische code-analyse over de hele repo (`src/`, `drizzle/`, `docs/`), geen toegang tot de live database (env-secrets niet gelezen)

Deze audit bouwt voort op twee eerdere reviews in de repo (`docs/review/audit-rapport.md`, 12 juni 2026, en `docs/reviews/panel-4-data-integriteit.md`, 26 juni 2026). Waar een eerder gemeld punt hier terugkomt staat dat vermeld — soms als bevestigd opgelost, soms als regressie, soms als nog steeds open.

---

## Leeswijzer / prioriteit

1. [🔴 Kritiek](#kritiek) — verifieer dit eerst, bepaalt de ernst van bijna alles daaronder
2. [🟠 Hoog](#hoog) — concrete financiële fouten of databeveiliging
3. [🟡 Medium](#medium) — technische schuld met reëel maar beperkt risico
4. [🟢 Laag / opruimen](#laag--opruimen) — nette codebase-hygiëne
5. [Database: wordt alles nog gebruikt?](#database-wordt-alles-nog-gebruikt)
6. [Wat wél goed is](#wat-wél-goed-is)

---

## 🔴 Kritiek

### K-1 — RLS is vermoedelijk volledig inert voor het Drizzle-pad (het grootste open risico)

**Onafhankelijk gevonden door zowel de security- als de database-analyse.**

`src/lib/db/index.ts` verbindt Drizzle rechtstreeks via `DATABASE_URL`/`SUPABASE_DB_URL` (Postgres connection string, zie `docs/setup-macbook.md`). Er wordt nergens `SET LOCAL`, `set_config('request.jwt.claims', ...)` of een vergelijkbare sessie-injectie gedaan om `auth.uid()` te vullen. De rol achter deze connection string is in Supabase-projecten typisch de `postgres`-rol (of een pooler-rol) met `BYPASSRLS`.

**Concreet gevolg:** alle 649 regels in `src/lib/db/rls.sql` — de policies waar CLAUDE.md regel 5 op leunt als "extra laag bovenop de expliciete `userId`-filter" — beschermen vermoedelijk **niets** van het verkeer dat via Drizzle loopt, wat vrijwel al het queryverkeer van de app is. RLS is dan alleen actief voor het smalle pad via `supabase-js`/PostgREST, dat volgens CLAUDE.md uitsluitend voor auth wordt gebruikt.

Dat betekent: de handmatige `tenantId`-filter in elke queryfunctie is in de praktijk **de enige grens tussen tenants**, niet een dubbele laag. Elke ontbrekende of onvolledige tenant-filter hieronder (zie K-2, H-6) is daarmee een direct exploiteerbaar cross-tenant datalek, niet een theoretisch risico met een backstop.

**Verifieer dit met voorrang** (kan met een eenmalige, read-only check, geen code-wijziging):
```sql
SELECT rolname, rolbypassrls FROM pg_roles WHERE rolname = current_user;
SHOW row_security;
```
Als `rolbypassrls = true`, is dit bevestigd en verdient het topprioriteit — ofwel door een dedicated, RLS-onderworpen DB-rol voor de Drizzle-connectie te gebruiken (met JWT-claims via `SET LOCAL` per request), ofwel door RLS bewust als "verdedigingslaag voor toekomstig PostgREST-gebruik" te documenteren terwijl de query-laag als enige echte grens wordt behandeld en dienovereenkomstig zwaarder getest.

**Status (2026-08-25): bevestigd, bewust niet opgelost — query-laag gehard als vangnet.**
De verificatiequery is uitgevoerd: `current_user = postgres`, `rolbypassrls = true`. RLS is dus daadwerkelijk inert voor het Drizzle-verkeer. Besluit: zolang er maar één tenant is, is het risico theoretisch; de aparte RLS-onderworpen DB-rol met per-request JWT-context (optie A) is een substantiële architectuurwijziging die pas nodig is zodra een tweede tenant/gebruiker echt wordt toegevoegd. Voor nu is gekozen voor de lichte vangnet-aanpak: `src/lib/db/queries/tenant-scoping.test.ts` is een statische test die voor elke query-functie afdwingt dat (a) ze `userId` als parameter neemt en (b) elke `update`/`delete`-mutatie op `tenantId` filtert — direct, via een `verify*Access`-helper, of via een inline pre-check die bij een lege match vroegtijdig stopt. Deze test ving bij het schrijven ervan meteen een echte instantie van dit patroon op in `updateRecurringItem` (tweede mutatie zonder scoping), die is gefixed. **Revisie-trigger:** zodra een tweede tenant wordt toegevoegd (bijv. een partner-login) of de Supabase Data API/PostgREST ooit voor iets anders dan auth wordt gebruikt, wordt optie A verplicht.

### K-2 — Netto vermogen negeert de `liabilities`-tabel volledig

**Locatie:** `src/app/page.tsx:73-78` (homepage), `src/app/cashflow/page.tsx:64-69`, `src/app/portfolio/page.tsx`

`calculateNetWorth` (`src/lib/finance/net-worth.ts:8-12`) accepteert alleen `{value, liability}`-paren per asset (bedoeld voor hypotheken via `mortgage_balances`). De losstaande `/schulden`-module (studieschuld, persoonlijke lening — precies waarvoor die module gebouwd is, zie `docs/review/audit-rapport.md` regel 56-59) wordt nergens opgehaald bij het berekenen van netto vermogen op homepage, cashflow-pagina of portfolio-overzicht.

**Scenario:** gebruiker voegt €20.000 studieschuld toe via `/schulden` → netto vermogen op drie plekken in de app blijft ongewijzigd, terwijl het feitelijk €20.000 te hoog wordt getoond. Dit is precies het soort stille financiële fout dat CLAUDE.md verbiedt ("geen silent failures op geld-paden") — hier geen crash, maar een structureel verkeerd KPI-getal op de belangrijkste pagina's van de app.

### K-3 — Vastgoed: kosten worden dubbel afgetrokken bij huurrendement-KPI's

**Locatie:** `src/app/portfolio/vastgoed/[id]/page.tsx:106-138`

```ts
const annualIncome = calculatePassiveIncome(txs, currentYearStart)   // trekt 'cost' er al vanaf
const annualCosts  = txs.filter(t => t.transactionType === 'cost').reduce(...)
const grossRentalYield = calculateGrossRentalYield(annualIncome, currentValue)   // dus eigenlijk al netto
const netRentalYield   = calculateNetRentalYield(annualIncome, annualCosts, currentValue)  // kosten 2x eraf
```

`calculatePassiveIncome` (`src/lib/finance/passive-income.ts:13-36`) berekent zelf al `dividend + interest + rental_income − cost`. Deze pagina behandelt de uitkomst vervolgens alsof het bruto inkomen is:
- **"Bruto huurrendement"** is in werkelijkheid al netto (kosten er één keer af getrokken).
- **"Netto huurrendement"** trekt de kosten er nóg een keer vanaf → dubbele aftrek.
- De cash-on-cash-berekening (regel 136) erft dezelfde fout.

Bij €12.000 huur en €2.000 kosten toont "Bruto huurrendement" bijvoorbeeld €10.000/waarde in plaats van €12.000/waarde, en "Netto huurrendement" €8.000/waarde in plaats van €10.000/waarde. Ter vergelijking: `src/app/cashflow/page.tsx:56-60` telt income/costs wél apart op zonder deze fout — het patroon bestaat elders al correct in de codebase.

### K-4 — Twee Server Actions accepteren geldbedragen zonder énige validatie

- **`src/app/portfolio/spaarrekeningen/actions.ts:75-86`** (`applyMonthlyDepositAction`): `amount = fd.get('amount') as string` gaat rechtstreeks naar `createTransaction` — **geen Zod-schema**. Een lege string, negatief bedrag of absurd getal passeert ongehinderd.
- **`src/app/portfolio/_archief-aandelen-etf/broker/[id]/import/actions.ts:149`** (`confirmImportAction`): deze Server Action neemt een JS-object (`ConfirmImportInput`) aan i.p.v. `FormData`. Het TypeScript-type is puur compile-time — er is **geen runtime-validatie** op `amount`, `quantity`, `pricePerUnit`, `fees`, `isin` uit `input.existing`/`input.newPositions`. Server Actions zijn benaderbaar via een directe POST naar het action-endpoint; een handgemaakte payload kan hier willekeurige, ongeldige transactiebedragen laten invoegen (tenant-scoping via `verifyAssetAccess` is hier overigens wél aanwezig — alleen bedragvalidatie ontbreekt volledig).

---

## 🟠 Hoog

### H-1 — Zod valideert geldbedragen op meerdere plekken nog steeds niet numeriek (F-4.4, deels nog open)

De eerder gemelde `positiveAmount()`-helper (`src/app/assets/actions.ts:338-341`) is toegevoegd en correct toegepast op `valuationSchema.value` en `mortgageBalanceSchema.outstandingBalance`. Maar:
- `transactionSchema.amount/quantity/pricePerUnit/fees` (`assets/actions.ts:103-110`) — nog steeds kale `z.string()`, geen numerieke/positiviteitscheck.
- `vorderingSchema.principalAmount/interestRate` en `realEstateSchema.purchasePrice/purchaseCosts/wozValue/mortgageOriginalAmount/mortgageInterestRate` (`assets/actions.ts:68-87`) — zelfde gat.
- Er zijn ook geen DB-`CHECK`-constraints als vangnet op deze kolommen (zie K-1: zonder werkende RLS is Zod-validatie aan de rand de enige verdediging op deze velden).

Wel goed: `cashflow/actions.ts` en `schulden/actions.ts` (m.u.v. `interestRate`, zie M-5) gebruiken een regex (`/^\d+(\.\d{1,2})?$/`) die dit wél afdwingt — dus het patroon bestaat al, is alleen niet overal toegepast.

### H-2 — `liabilities.ts` UPDATE-query filtert niet op tenantId in de mutatie zelf

**Locatie:** `src/lib/db/queries/liabilities.ts:64-80` (`updateLiability`)

`verifyLiabilityAccess` checkt vooraf op tenant, maar de daadwerkelijke `UPDATE`-query filtert alleen op `eq(liabilities.id, liabilityId)` — geen `tenantId` in de `WHERE`-clause zelf. Dit is exact het patroon dat CLAUDE.md regel 5 verplicht ("elke query filtert expliciet op userId"). Gegeven K-1 (RLS vermoedelijk inert) is dit geen theoretisch punt. Wel een relativering: volgens de dode-code-analyse wordt `updateLiability` momenteel **nergens aangeroepen** — dus vandaag niet actief exploiteerbaar, maar wel een risico zodra de functie in gebruik wordt genomen (bv. een "bewerk schuld"-formulier).

### H-3 — Query-layer regel geschonden in actieve code (regressie)

**Locatie:** `src/app/portfolio/spaarrekeningen/actions.ts:6,9-10,56-59`

Directe `import { db } from '@/lib/db'` + inline `db.update(savingsDetails).set(...)` binnen een Server Action, buiten `src/lib/db/queries/`. Dit is exact de overtreding die het audit-rapport van 12 juni als opgelost markeerde voor `page.tsx`-bestanden — die fix houdt stand, maar is teruggeslopen in een nieuwere `actions.ts`. CLAUDE.md regel 2 is hier niet-onderhandelbaar bedoeld.

### H-4 — `_archief-aandelen-etf` bevat productie-afhankelijkheden — geen zuivere dode map

`ImportTransactionsForm.tsx`, `DeleteBrokerButton.tsx`, `BuyTransactionForm.tsx`, `SellTransactionForm.tsx` en `StockSearchInput.tsx` (allemaal actief gebruikt vanuit levende routes zoals `src/app/assets/[id]/transactions/new/page.tsx`) importeren server-logica uit `_archief-aandelen-etf/actions.ts`, `market-actions.ts` en `broker/[id]/import/actions.ts`. Dit is architecturaal fragiel: de map heet "archief" en de underscore-prefix suggereert "veilig te verwijderen", terwijl 376 regels erin daadwerkelijk productiecode zijn. Een toekomstige opschoning die de hele map verwijdert (een voor de hand liggende actie gezien de naam) breekt de app. Dit verdient een expliciete melding, geen automatische fix hier.

### H-5 — Schulden: `interestRate` kan de pagina crashen

**Locatie:** `src/app/schulden/actions.ts:13` vs. `src/app/schulden/page.tsx:76`

`interestRate: z.string().optional().nullable()` heeft — in tegenstelling tot `amount` — geen formaatvalidatie. Bij invoer als `"abc"` (of een niet-browser POST) slaagt `createLiabilityAction`, en crasht vervolgens `new Decimal(liability.interestRate)` op elke render van `/schulden` met een ongevangen `DecimalError`, tot de rij handmatig uit de database verwijderd wordt.

### H-6 — `getTransactionsByAssetsDetailed` heeft nog steeds geen eigen tenant-check (F-4.9, nog open)

**Locatie:** `src/lib/db/queries/transactions.ts:145-159`

Ongewijzigd sinds de vorige review. Alle huidige aanroepers geven wel al tenant-gefilterde `assetIds` mee, dus vandaag geen actief lek — maar de functie zelf biedt geen bescherming. Gegeven K-1 is dit een reëler risico dan de vorige review het inschatte.

### H-7 — Simple-entries-tabellen missen een UPDATE-RLS-policy die de code wél gebruikt

**Locatie:** `src/lib/db/rls.sql:532-595` vs. `src/lib/db/queries/simple-entries.ts` (regels 57, 89, 121, 153, 185)

De vijf `*_entries`-tabellen (stock_etf, crypto, pension, savings, real_estate) hebben SELECT/INSERT/DELETE-policies maar geen UPDATE-policy, terwijl `simple-entries.ts` voor alle vijf daadwerkelijk `db.update(...)` aanroept. Onder een regime waar RLS wél zou gelden, zou dit 0 rijen raken bij elke edit. Nu vermoedelijk onschadelijk door K-1, maar inconsistent en foutgevoelig als K-1 ooit wordt gefixt zonder dit gat mee te nemen.

---

## 🟡 Medium

### M-1 — Migratie-/snapshothistorie structureel kapot, groter dan gedacht

`drizzle/migrations/meta/` bevat alleen snapshots `0000`–`0004`; migraties `0005`–`0017` (13 stuks, incl. het nieuwe `0017_one_time_expenses_category.sql`) zijn allemaal buiten `db:generate` om handmatig geschreven. STATUS.md noemt dit al als bekend/open probleem maar begrenst het tot 0005-0011 — het is dus nog iets breder dan het eigen statusdocument aangeeft. Gevolg: `npm run db:generate` faalt zodra het schema wijzigt (interactieve rename-prompt, drizzle-kit kan zonder snapshothistorie niet bepalen of een kolom hernoemd of nieuw is). Dit blokkeert de normale workflow bij elke volgende schemawijziging tot de ontbrekende snapshots lokaal (met een echte TTY) geregenereerd zijn — inhoudelijk sluiten de migraties overigens wél netjes aan op schema.ts, dit is puur een tooling-probleem, geen datadrift.

### M-2 — Geen DB-`CHECK`-constraints op geldkolommen (ontwerp-afwijking)

`docs/project files/data-model.md` schreef oorspronkelijk `CHECK (amount >= 0)` voor op `transactions.amount`; in de huidige `schema.ts` ontbreekt dit voor vrijwel alle geldkolommen (transactions, asset_valuations, alle simple-entries-bedragen, vordering/real-estate/mortgage-velden, liabilities, recurring_item_amounts, one_time_expenses). De enige verdediging is Zod aan de rand (zie H-1), zonder DB-garantie bij seed-scripts, toekomstige directe inserts, of een ooit heractiveerde PostgREST-toegang.

### M-3 — `docs/project files/data-model.md` is op meerdere plekken substantieel achterhaald

Niet alleen `transactions` (al gemarkeerd in het document zelf): `stock_etf_details`, `crypto_details`, `savings_details`, `pension_details`, `liabilities` en vooral `asset_tax_metadata` (doc: `tax_box TEXT`, code: `box INTEGER` — een echt typeverschil, niet alleen naamgeving) wijken af. `brokers`, alle vijf simple-entries-tabellen en `vordering_details` ontbreken volledig in het document; de ERD mist ook `recurring_items`/`one_time_expenses` hoewel die elders in het document wel apart beschreven staan.

### M-4 — Gemengde foutafhandeling in Server Actions

Drie stijlen naast elkaar voor dezelfde soort fout (create-validatie):
1. `{ error }`-object — `cashflow/actions.ts:42-44, 125-127`
2. Stille no-op zonder foutmelding — `cashflow/actions.ts:73, 150` (`if (!parsed.success) return`)
3. `throw new Error(...)` — `schulden/actions.ts:34-36`

Geen duidelijke regel wanneer welke stijl geldt; patroon 2 is het problematischst omdat de gebruiker geen enkele terugkoppeling krijgt bij een mislukte validatie.

### M-5 — Duplicatie tussen featuremodules die opvalt bij nieuwe features

- **Delete-knoppen**: `DeleteLiabilityButton`, `DeleteAssetButton`, `DeleteValuationButton`, `DeleteBrokerButton` — bijna identieke `'use client'` + form + `confirm()`-inline-onClick. `AssetSection.tsx` herschrijft het patroon zelfs een vijfde keer inline in plaats van `DeleteAssetButton` te hergebruiken.
- **Form-submitlogica**: `OneTimeExpenseForm.tsx:15-27` en `RecurringItemForm.tsx:11-25` — identieke `handleSubmit` (formRef, error-state, reset bij succes).
- **List-filterlogica**: `RecurringItemList.tsx:23-45` en `OneTimeExpenseList.tsx:21-44` — bijna 1-op-1 dezelfde filter/sort-combinatie.
- **Auth-boilerplate in Server Actions**: `assets/actions.ts` heeft al een `requireUser()`-helper; `cashflow/actions.ts` (6×) en `schulden/actions.ts` (2×) herschrijven dezelfde 3 regels (`createServerSupabaseClient` → `getUser` → `redirect('/login')`) inline.

Geen van deze is een bug, maar het is precies het soort duplicatie dat bij de volgende featuremodule (Fase E, fiscale laag) opnieuw gekopieerd zal worden tenzij het nu wordt samengetrokken.

### M-6 — `src/lib/db/queries/transactions.ts` heeft nog een eigen `getTenantId()` (gedeeltelijke regressie)

Het audit-rapport van 12 juni claimt "drie kopieën `getTenantId` → opgelost via `getOrCreateTenant()`". Dat klopt voor bijna alle bestanden, behalve `transactions.ts:6-14`, dat nog een lokale `getTenantId()` heeft met ander gedrag (throwt bij ontbrekende tenant i.p.v. auto-aanmaken). Geen drie kopieën meer, maar wél één overgebleven afwijking van het "opgeloste" punt.

### M-7 — Cashflow-pagina's netto-vermogen-KPI mist de simpele-invoerlijsten

**Locatie:** `src/app/cashflow/page.tsx:30-34, 63-72`

Bouwt netto vermogen uitsluitend uit volledige asset-tracking (`getAssetsWithValues`/`getNetWorthAtDate`), terwijl `portfolio-summary.ts:18-24` bewust ook de vijf `*_entries`-tabellen meeneemt "anders ontbreekt een deel van iemands vermogen". Wie bijvoorbeeld pensioen alleen via de simpele lijst bijhoudt, ziet een onvolledige groei-KPI op de cashflow-pagina.

### M-8 — Misleidend label bij "illiquide" op de homepage

**Locatie:** `src/app/page.tsx:80-83, 131-135`

De kaart toont altijd "waarvan €X illiquide (**pensioen**)", ook als het illiquide bedrag volledig uit een `vordering`-asset bestaat (die ook niet in `LIQUID_ASSET_TYPES` zit). Bedrag klopt, label niet.

### M-9 — `stockEtfDetails.brokerId` heeft geen index

**Locatie:** `src/lib/db/schema.ts:181`

De enige gevonden FK-kolom die vaak gefilterd/gejoind wordt (posities per broker, `BrokerPositionsTable.tsx`, `broker/[id]/page.tsx`) zonder eigen index. Op de huidige (kleine) dataschaal geen acuut probleem.

### M-10 — `interestRate` bij schulden en enkele weergavevelden gebruiken geen Decimal

Naast H-5: `vorderingen/page.tsx:78` en `[id]/page.tsx:39` gebruiken `parseFloat(d.interestRate)` i.p.v. Decimal voor weergave. Puur presentatie (geen rekenwerk erop), dus laag risico, maar tegen de expliciete CLAUDE.md-regel "nooit floating point voor geldbedragen" — ook percentages horen bij die regel.

---

## 🟢 Laag / opruimen

- **`AssetSection.tsx`** is volledig `'use client'` zonder enige hook, puur vanwege één inline delete-form — kandidaat om te herschrijven als Server Component met een geïmporteerde `DeleteAssetButton`.
- **`src/lib/finance/stock-series.ts:4`** importeert een type uit `@/lib/db/queries/transactions` — type-only (geen runtime-afhankelijkheid), maar doorbreekt de bedoelde "puur TypeScript, geen kennis van lib/db"-grens van `lib/finance`.
- **`fx_rates`**-tabel: aantoonbaar ongebruikt in code, maar bewust gereserveerd (schema-comment) — geen actie nodig, wel een reminder dat de valutastrategie (F-4.1/F-4.2 uit panel-4, nog steeds open volgens STATUS.md) een blokkerende openstaande beslissing is.
- **`asset_tax_metadata`**: alleen geschreven (bij `createAsset`), nergens gelezen of getoond in de UI. Ofwel bouwen (Fase E fiscale laag) ofwel als bewust "voorbereid voor later" documenteren.
- **Vermoedelijk ongebruikte geëxporteerde functies** (grep-schatting, geen compileranalyse): `buildSavingsGrowthSeries` (`savings-series.ts:21`), `getMortgageBalanceHistory` (`mortgage-balances.ts:50`), `getPortfolioTxDates` (`cashflow.ts:168`), `getValuations` (`valuations.ts:49`), `updateLiability` (`liabilities.ts:64`, zie ook H-2).
- **532 regels aantoonbaar dode routes** in `_archief-aandelen-etf/` (de `page.tsx`-bestanden zelf, niet de 376 regels actions die nog gebruikt worden — zie H-4).
- Geen `debugger`-statements, geen verdachte `console.log`-clusters (de 17 gevonden logs zitten allemaal legitiem in `seed.ts`/`seed-aandelen-test.ts`), slechts 2 TODO's totaal — code is hierin netjes.
- Geen hardcoded secrets/keys gevonden in `src/`/`drizzle/`.

---

## Database: wordt alles nog gebruikt?

| Tabel/kolom | Status |
|---|---|
| `fx_rates` | Ongebruikt, bewust gereserveerd voor "Optie B" (multi-currency) — niet verwijderen zonder de valutabeslissing eerst te nemen |
| `asset_tax_metadata` | Write-only — nooit gelezen in de UI |
| `pensionDetails.projectedAnnualBenefit` | Actief gebruikt |
| `vorderingDetails.*` | Actief gebruikt |
| `stockEtfDetails.instrumentType`/`accountType` | Actief gebruikt |
| `savingsDetails.monthlyDepositAmount` | Actief gebruikt |
| `mortgages.mortgageType` | Actief gebruikt |
| `users` (los van `tenant_users`) | Nooit direct gequeried, uitsluitend via de `tenantUsers`-join — consistent met het RLS-ontwerp, geen probleem |
| `liabilities` | Tabel + CRUD volledig gebouwd, maar **niet meegenomen in netto-vermogen-berekeningen** (zie K-2) |
| Alle overige tabellen (transactions, assets, valuations, mortgages/mortgage_balances, recurring_items(+amounts), one_time_expenses, brokers, simple-entries × 5) | Actief gebruikt, geen dode kolommen gevonden |

**RLS-dekking:** alle 25 tenant-tabellen hebben inmiddels `ENABLE ROW LEVEL SECURITY` + policies (F-4.10 uit panel-4, `brokers` ontbrak toen — dat is opgelost). Enige resterende gat: geen UPDATE-policy op de vijf simple-entries-tabellen (H-7). Zie K-1 voor de vraag of RLS momenteel überhaupt wordt afgedwongen.

**Migraties:** inhoudelijk consistent met `schema.ts`, maar de snapshot-tooling is kapot voor 13 van de ~17 migraties (M-1) — dit is een workflow-blokkade, geen datacorruptierisico.

*Live database is niet bevraagd (geen toegang tot `.env.local`). Voor daadwerkelijke rijaantallen / "wordt dit veld ooit ingevuld" zou een read-only `SELECT count(*)`/`SELECT count(*) FILTER (WHERE x IS NOT NULL)` per kandidaat-kolom nodig zijn — kan alsnog uitgevoerd worden als er een read-only DB-toegang beschikbaar wordt gesteld.*

---

## Wat wél goed is

Om het beeld niet te verstoren: de architectuur is over het geheel genomen degelijk voor een solo-project van deze omvang.

- **Consistent decimal.js-gebruik** in de rekenkern; floating point voor geld is vrijwel nergens gevonden (de paar `parseFloat`-uitzonderingen zijn puur presentatie, zie M-10).
- **Server/Client-scheiding** is in de overgrote meerderheid van de ~140 bestanden correct toegepast; de paar uitzonderingen (M-5, laag-sectie) zijn kleine, geïsoleerde gevallen.
- **Query-laag discipline** wordt bijna overal gevolgd — de twee gevonden overtredingen (H-3) zijn de uitzondering, niet de regel, en eerdere overtredingen zijn aantoonbaar gefixt.
- **Zod aan de rand** is het gangbare patroon; het probleem is dekking (H-1), niet het ontbreken van het patroon zelf.
- **Geen SQL-injectie, geen XSS** gevonden — alle queries lopen via Drizzle's parameterized builder, geen `dangerouslySetInnerHTML` in de hele codebase.
- **Auth-flow** (`proxy.ts`, login/wachtwoord-acties) is correct opgezet: geen open redirects, geen user-enumeratie via foutmeldingen, kleine expliciete publieke-paden-whitelist.
- **Service-role key** wordt uitsluitend in losstaande CLI-seedscripts gebruikt, nergens in app-/client-code.
- De eerdere audit (12 juni) en panel-4-review (26 juni) zijn overwegend serieus opgevolgd — van de destijds gemelde punten is het merendeel aantoonbaar opgelost; alleen K-1/H-1 (RLS) en enkele kleinere regressies (H-3, M-6) zijn nieuw of nog open.

---

## Aanbevolen volgorde

1. **K-1 verifiëren** (RLS-rol check, 5 minuten werk) — bepaalt hoe zwaar de rest weegt.
2. **K-2, K-3** — twee KPI-fouten die gebruikers dagelijks een verkeerd getal laten zien; dit sluit aan bij het al lopende "financiële correctheid"-traject uit STATUS.md (Panel 1 nog te doen).
3. **K-4, H-1, H-5** — validatiegaten dichten, hergebruik de bestaande `positiveAmount()`/regex-patronen die al elders in de codebase bewezen werken.
4. **H-2, H-3, H-6, H-7** — mechanische fixes, klein per stuk.
5. De **medium/laag**-punten zijn geschikt om mee te nemen zodra een module toch wordt aangeraakt (bv. bij de nog geplande reviews van vastgoed/pensioen/vorderingen/schulden/homepage uit STATUS.md), niet per se een aparte sprint waard.
