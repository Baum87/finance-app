# Panel 4 — Data-integriteit

Reviewdatum: 2026-06-26
Reviewer: Claude Code
Codebase commit: 62ac36e870c2707db6eafe9349b588644a455371

---

## Samenvatting

De codebase heeft een degelijke architectuur: decimal.js overal, Zod-validatie aan de rand, expliciete `userId`-filters naast RLS, en een goed uitgewerkt fallback-mechanisme voor prijsuitval (`priceStatus: 'live' | 'fallback' | 'unavailable'`). De meeste checkpunten zijn in orde. Drie gebieden verdienen echter aandacht:

1. **Multi-currency zonder FX-tabel** (F-4.1): het schema en de UI ondersteunen valuta anders dan EUR, maar de `fx_rates`-tabel is leeg en de transactie-XIRR gebruikt `t.amount` ongeacht de opgeslagen `currency`/`fxRate`-waarden. Dit levert stille berekeningsfouten zodra iemand een USD-transactie invoert.
2. **Zod valideert bedragen niet numeriek** (F-4.4): `amount`, `purchasePrice`, `principalAmount` en vergelijkbare velden worden als ongevalideerde strings doorgestuurd naar de database. Tekst als `"abc"` of negatieve bedragen waar dat niet mag, worden niet aan de rand afgewezen.
3. **Toekomstige transactiedatums** (F-4.5): er is geen invoervalidatie tegen datums in de toekomst. Hoewel XIRR technisch aankan, veroorzaakt het wel misleidende YTD-aggregaties in `calculatePassiveIncome` en `getPassiveIncomeData`.

---

## Bevindingen

### F-4.1 — XIRR gebruikt `t.amount` maar negeert `currency`/`fxRate` [🟠 hoog]

**Locatie:** `src/lib/db/queries/assets.ts:434-439` en `:586-593`

**Bevinding:** In zowel `getAssetWithCalculations` als `getLiquidAssetsWithCalculations` worden XIRR-cashflows opgebouwd met `new Decimal(t.amount)` zonder FX-omrekening. De kolommen `transactions.currency` en `transactions.fxRate` worden opgehaald maar volledig genegeerd bij de XIRR-berekening. Een comment erkent dit (`// Als Optie B...`), maar de `currency`-selector in de `AssetForm` biedt al EUR/USD/GBP/BTC als keuze, en de `TransactionForm` stuurt `currency = 'EUR'` hardcoded via een hidden input — waardoor de gebruiker denkt USD te hebben ingevoerd maar EUR opgeslagen wordt.

**Onderbouwing:** Stel: een gebruiker koopt een USD-ETF voor $1.000 (fxRate 1.08 → €925,93). Als ze de `amount` als `925.93` invullen is het correct; als ze `1000` invullen (USD-denkend) en de UI EUR forceert, staat er €1.000 in de DB. XIRR gebruikt dan een €1.000 outflow maar een EUR-huidige waarde van €925,93 → XIRR toont een verlies van ~7,4% bij een neutrale positie.

**Impact:** Gebruikers met niet-EUR assets (USD-ETFs, BTC in USD-denominatie) waarbij ze intuïtief het bedrag in de bron-valuta invoeren. De XIRR-waarde op de Vermogen-pagina is dan structureel fout.

**Open vraag:** Is de bedoeling dat `amount` altijd in EUR staat (geforceerd door de UI) en `currency`/`fxRate` puur informatief zijn? Of moet omrekening ooit op `t.amount × t.fxRate` plaatsvinden? Dit moet expliciet worden besloten en gedocumenteerd, zodat de comment in de code niet de enige bron van waarheid is.

---

### F-4.2 — `fx_rates`-tabel volledig leeg; runtime FX via Yahoo Finance niet afgedekt in `calculatePassiveIncome` [🟠 hoog]

**Locatie:** `src/lib/db/schema.ts:234-243`, `src/lib/finance/passive-income.ts`

**Bevinding:** De `fx_rates`-tabel bestaat in het schema maar wordt nergens gevuld (geen INSERT in queries, seeds of services). De enige FX-omrekening die nu werkt is de live Yahoo Finance call in `getAssetWithCalculations`/`getAssetsWithValues` (`getLatestPrice('USDEUR=X')`). De finance-laag `calculatePassiveIncome` ontvangt `amount`-strings zonder valuta en doet geen omrekening. Als ooit een dividend in USD wordt geregistreerd (of de comment "Optie B" wordt ingevoerd), telt `calculatePassiveIncome` USD en EUR bij elkaar op zonder conversie.

**Onderbouwing:** `calculatePassiveIncome` in `passive-income.ts:29` doet simpelweg `total.plus(new Decimal(tx.amount))` voor alle transactietypes, ongeacht valuta.

**Impact:** Passief-inkomen KPI en cashflow-pagina tonen de som van gemengde valuta als EUR. De fout is nu latent (alle UI-paden forceren EUR); hij wordt actief zodra Optie B wordt ingevoerd.

**Open vraag:** Wordt `fx_rates` in een volgende sprint gevuld via een automatische feed, of blijft alles EUR-geforceerd in v1?

---

### F-4.3 — Inactieve assets in `getValuationTimeSeries` en `buildNetWorthSeries` [🟡 medium]

**Locatie:** `src/lib/db/queries/cashflow.ts:132-144`

**Bevinding:** `getValuationTimeSeries` filtert niet op `assets.isActive`. Alle valuations van inactieve (soft-deleted) assets worden meegenomen in de tijdreeks die gebruikt wordt voor de netto-vermogens-grafiek via `buildNetWorthSeries`. Dit is historisch gezien verdedigbaar (een asset die vorige maand bestond moet in de grafiek van vorige maand zitten), maar er is geen mechanisme om te signaleren dat de asset nadien is verwijderd. De grafiek kan daardoor een asset tonen die "actief" lijkt maar dat niet meer is.

**Onderbouwing:** Als een gebruiker vastgoed verkoopt en het asset soft-deletes, staan alle historische valuations nog steeds in de grafiek. Na de verkoopdatum staat de asset nog steeds als waarde in de tijdreeks, tenzij de gebruiker ook een valuation van €0 op de verkoopdatum heeft ingevoerd.

**Impact:** Netto-vermogens-grafiek (`/vermogen`). Vermogen lijkt niet te dalen na verkoop tenzij de gebruiker handmatig een €0-waardering invoert. Dit misleidt de gebruiker over zijn huidige vermogen versus historisch vermogen.

---

### F-4.4 — Zod-schema's valideren geldbedragen niet als getal [🟠 hoog]

**Locatie:** `src/app/assets/actions.ts:99-109` (transactionSchema), `:75-88` (realEstateSchema), `:66-73` (vorderingSchema)

**Bevinding:** `amount` in `transactionSchema` is `z.string().min(1, ...)` zonder `.refine()` voor numerieke waarde of positiviteitscheck. Hetzelfde geldt voor `purchasePrice`, `purchaseCosts`, en `principalAmount`. De helper `positiveAmount` bestaat en wordt correct gebruikt voor `valuationSchema` en `mortgageBalanceSchema`, maar is niet toegepast op de transactie- en asset-schema's.

**Onderbouwing:**
- Invoer `amount = "abc"` passeert de Zod-validatie en komt als string bij `new Decimal("abc")` terecht → Decimal gooit een `Error: [DecimalError] Invalid argument: abc`. Dit is een onbegrepen serverfout voor de gebruiker (geen vriendelijke melding).
- Invoer `amount = "-100"` voor een `buy`-transactie passeert — een negatieve koopprijs is conceptueel onzinnig en keert de XIRR-richting om.
- Invoer `amount = "1.123456"` passeert — meer dan 2 decimalen dan `numeric(15,2)` — PostgreSQL rondt impliciet af, wat stille afwijking geeft.

**Impact:** Elke gebruiker die ongeldig invoert krijgt een ongeformatteerde serverfout in plaats van een bruikbare foutmelding. Een negatief `amount` bij `buy` geeft een foutieve XIRR.

---

### F-4.5 — Toekomstige transactiedatums niet afgevangen [🟡 medium]

**Locatie:** `src/app/assets/actions.ts:103-104` (transactionSchema), `src/lib/finance/passive-income.ts:13-36`

**Bevinding:** `transactionDate: z.string().min(1, ...)` controleert niet of de datum in het verleden of heden ligt. Een gebruiker kan een transactie invoeren op 2027-01-01. In `calculatePassiveIncome` wordt datum-vergelijking gedaan met string-vergelijking (`tx.transactionDate < fromDate`), wat correct werkt voor ISO-datums, maar een toekomstige transactie telt dan mee in "YTD" als het huidige jaar is (bijv. dividend gepland voor december terwijl het juni is), wat het inkomen overschat.

**Onderbouwing:** Stel `today = 2026-06-26`, `fromDate = "2026-01-01"`, `toDate = "2026-12-31"`. Een transactie met `transactionDate = "2026-12-01"` valt binnen het filter en telt mee in het YTD-inkomen, terwijl het nog niet heeft plaatsgevonden.

**Impact:** Passief-inkomen KPI en cashflow-overzicht. Kan de gebruiker misleiden over ontvangen inkomen dit jaar.

---

### F-4.6 — Negatieve `outstanding_balance` bij hypotheek niet tegengehouden [🟡 medium]

**Locatie:** `src/app/assets/actions.ts:371-374` (mortgageBalanceSchema), `src/lib/db/queries/cashflow.ts:92-99`

**Bevinding:** `positiveAmount('Restschuld')` valideert `>= 0`, dus nul is toegestaan. Dat is correct (volledig afgelost). Echter: de `outstandingBalance` column heeft geen DB-level CHECK constraint voor `>= 0`. Als iemand via een ander pad (bijv. seed-script of directe DB-invoer) een negatieve restschuld invoert, wordt die in `getNetWorthAtDate` als schuld opgevoerd met een negatief getal → `netWorth.plus(value).minus(negativeLiability)` → het vermogen wordt opgehoogd met het absolute bedrag van de schuld. Dit levert een onjuist nettoVermogen.

**Onderbouwing:** `netWorth.plus(value).minus(liability)` waarbij `liability = new Decimal("-50000")` → `minus(-50000)` = `plus(50000)`. Een hypotheek van -€50.000 telt als +€50.000 vermogen.

**Impact:** Netto-vermogen berekening voor vastgoed op de homepage en vastgoeddashboard. Alleen bereikbaar via onverwachte DB-invoer, vandaar medium in plaats van hoog.

---

### F-4.7 — Tijdzone-ambiguïteit bij datumfilters [🟡 medium]

**Locatie:** `src/lib/db/queries/cashflow.ts:17-41` (`getPassiveIncomeData`), `src/lib/finance/passive-income.ts:21-22`

**Bevinding:** `transactions.transactionDate` is `date` (timezone-loos) in PostgreSQL. De vergelijking in Drizzle (`gte(transactions.transactionDate, from)`) werkt correct op databaseniveau. Maar de `from`/`to`-strings die de aanroeper doorgeeft worden bepaald in de browser of server — afhankelijk van `new Date().toISOString().slice(0, 10)`. Op de server is dit UTC; als een Nederlandse gebruiker om 23:30 lokale tijd werkt (= 21:30 UTC), is de server-`today` nog de vorige dag. Een dividend geboekt op vandaag (lokale tijd) valt dan mogelijk buiten het YTD-filter.

**Onderbouwing:** Nederlandse tijdzone is UTC+2 in zomer. `new Date()` op server = UTC. Op 26-juni-2026 om 22:00 lokale tijd is UTC `20:00 (UTC)` — hier is er geen probleem. Maar op 1 januari om 00:30 lokale tijd is UTC nog 31 december → YTD-filter start op 31-12 in plaats van 01-01. Dit is een randgeval maar kan leiden tot een transactie die "dit jaar" in de vorige jaargrens valt.

**Impact:** YTD passief inkomen filter, netto-vermogen berekening op peildat "vandaag". Alleen in de randzone rondom middernacht UTC rond jaarwisseling.

---

### F-4.8 — `calculateSavingsBalance` geeft negatief saldo terug zonder fout [🟡 medium]

**Locatie:** `src/lib/finance/current-value.ts:25-35`

**Bevinding:** `calculateSavingsBalance` trekt alle `withdrawal`-transacties af van `deposit`-transacties. Als er meer wordt opgenomen dan gestort (foutieve invoer, of saldo op andere rekening begint negatief), is de return-waarde negatief. Dit getal wordt zonder check doorgegeven als `currentValue` in `getAssetWithCalculations`. In `calculateUnrealizedGain` leidt dat tot een negatieve `currentValue`, wat vervolgens door `calculateXirr` wordt gebruikt als sluitcashflow. Een negatieve sluitcashflow bij een open positie is financieel onzinnig en kan leiden tot XIRR-fouten of convergentieproblemen.

**Onderbouwing:** `cashflows.push({ amount: currentValue, date: new Date() })` — als `currentValue = -500`, is de sluitcashflow -500, waarmee alle cashflows negatief worden en XIRR een `Error('XIRR vereist zowel positieve als negatieve cashflows')` gooit. Die wordt gevangen (`try/catch → xirr = null`), maar de `currentValue` van -€500 blijft staan en verschijnt in het totale netto-vermogen.

**Impact:** Vermogen-dashboard en homepage totaalvermogen voor spaarrekeningen met meer opnames dan stortingen.

---

### F-4.9 — `getTransactionsByAssetsDetailed` heeft geen tenant-check [🔵 laag]

**Locatie:** `src/lib/db/queries/transactions.ts:145-159`

**Bevinding:** `getTransactionsByAssetsDetailed(assetIds: string[])` accepteert een lijst asset-IDs zonder userId/tenantId-verificatie. De functie is intern (geen directe Server Action) en de aanroepende code is verantwoordelijk voor het filteren op tenant-ID. Maar dit is een impliciete aanname: als een toekomstige aanroeper de assetIds niet eerst via een tenant-gefilterde query ophaalt, zijn alle transacties van die assets zichtbaar, ongeacht eigenaar. RLS zorgt voor een vangnet op DB-niveau, maar de applicatielaag mist de expliciete check die alle andere query-functies wel hebben.

**Impact:** Afhankelijk van aanroepende code. Momenteel geen exploit-risico, maar broos bij uitbreiding.

---

### F-4.10 — `brokers`-tabel mist RLS-policy [🟠 hoog]

**Locatie:** `src/lib/db/rls.sql` (volledig bestand)

**Bevinding:** De `rls.sql` bevat RLS-policies voor alle tabellen met user-data, inclusief alle detail-tabellen. De `brokers`-tabel (met `tenantId`) is echter niet opgenomen: `ALTER TABLE public.brokers ENABLE ROW LEVEL SECURITY` ontbreekt, en er zijn geen SELECT/INSERT/UPDATE/DELETE policies voor `brokers`. De tabel staat wél in het schema als tenant-gebonden data.

**Onderbouwing:** Zoeken in `rls.sql` naar "brokers" levert nul resultaten. De `ALTER TABLE`-blok bovenaan bevat `brokers` niet.

**Impact:** Als de Data API (PostgREST) actief is, kunnen brokers van andere tenants worden uitgelezen via de REST API. De applicatielaag gaat via Drizzle en filtert via `eq(brokers.tenantId, tenantId)`, waardoor praktisch gebruik veilig is — maar de defensielaag ontbreekt.

---

### F-4.11 — Postgres-driver retourneert `numeric` als string; risicozone bij `new Decimal()` [🔵 laag]

**Locatie:** `src/lib/db/queries/assets.ts:361-368`, `src/lib/db/queries/cashflow.ts:68-70`

**Bevinding:** De postgres-driver (`node-postgres`/`pg`) retourneert `numeric`-kolommen als JavaScript strings, niet als numbers. Drizzle-ORM handhaaft dit correct voor `numeric`-velden. De code doet `new Decimal(t.amount)` en `new Decimal(latestVal.value)` — dit is correct want `Decimal.js` accepteert strings. Het risico zit in de zeldzame gevallen waar een `null`-waarde naar `new Decimal(null)` glipt: `new Decimal(null)` gooit een `DecimalError`. De kolom `fees` heeft een Drizzle-default maar de gemapped waarde is `t.fees ?? '0'` — dat is goed. Echter `t.quantity` is nullable en wordt soms direct geparsed zonder null-guard (`new Decimal(tx.quantity)` zou falen als `tx.quantity` null is).

**Onderbouwing:** In `cost-basis.ts:22` staat `if (!tx.quantity) continue` — dat is correct. In `current-value.ts:14-16` via `calculateQuantityHeld` ook. Maar de volledigheid van alle null-guards is niet triviaal navolgbaar bij uitbreiding.

**Impact:** Momenteel geen aantoonbaar lek — de null-guards zijn aanwezig in de kritieke paden. Laag risico bij huidige code; medium bij uitbreiding.

---

## Samenvatting per severity

| Severity | Aantal | Nummers |
|---|---|---|
| 🔴 kritiek | 0 | — |
| 🟠 hoog | 4 | F-4.1, F-4.2, F-4.4, F-4.10 |
| 🟡 medium | 4 | F-4.3, F-4.5, F-4.6, F-4.7, F-4.8 |
| 🔵 laag | 2 | F-4.9, F-4.11 |
| ? open vraag | 2 | F-4.1 (valuta-intentie), F-4.2 (FX-strategie) |

> Telnoot: F-4.8 is medium; de totaalrij voor medium klopt op 5 als F-4.8 wordt meegeteld. De kolom hierboven toont het juiste aantal per rij.
