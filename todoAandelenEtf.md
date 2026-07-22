# TODO — Aandelen & ETF's (verdiepende review)

> Analyse van `/portfolio/aandelen-etf/` na afronding van `TODO.md` (v1).
> Uitgevoerd door de code te lezen (niet alleen de UI), met de bril van
> financieel expert én eindgebruiker op. Elke bevinding is geverifieerd
> in de bron — bestand:regel erbij.

---

## Kritiek — financiële correctheid

> ✅ **F-1, F-2, F-3 zijn afgerond.** Nieuwe gedeelde module
> `src/lib/finance/xirr-cashflows.ts` (`buildXirrCashflows`, `hasMinimumXirrPeriod`)
> is nu de enige plek die bepaalt welke transactietypes meetellen in XIRR, met
> welk teken, en de 30-dagen-drempel. Hergebruikt door: `getAssetWithCalculations`,
> `getLiquidAssetsWithCalculations` (beide `assets.ts`), `PortfolioOverview.tsx`
> (aandelen én crypto) en `/vermogen` — dat laatste was een **vierde**,
> niet eerder gedocumenteerde duplicatie die tijdens de refactor aan het licht kwam.
> De broker-detailpagina gebruikt nu `calculateNetDeposit` i.p.v. een handmatige som.
> 6 nieuwe tests in `finance.test.ts` (49 totaal, allemaal groen). De YTD-vensterlogica
> op `/vermogen` (R3-annualisatiekwestie) is bewust ongemoeid gelaten — hoort bij R-1.

- [x] **F-1: Portfolio-XIRR ("Rendement"-tegel) mist dividend/interest/rental_income en `cost`**
  `src/components/portfolio/PortfolioOverview.tsx:43-51` bouwt de cashflows voor de
  XIRR-tegel zelf, los van de canonieke logica in `getAssetWithCalculations`
  (`src/lib/db/queries/assets.ts:431-457`). Daar geldt:
  `XIRR_OUTFLOWS = buy, deposit, cost` / `XIRR_INFLOWS = sell, withdrawal, dividend, interest, rental_income`.
  Op de portfoliopagina worden **alleen** `buy/deposit` en `sell/withdrawal` meegenomen.
  Concreet met de testdata: ASML/MSFT/Unilever-dividenden en Apple/Shell-kosten
  tellen wél mee in de XIRR per positie, maar niet in de portfolio-XIRR bovenaan.
  Bij een portfolio met veel dividend groeit deze inconsistentie.
  Extra verschil: de portfoliopagina telt `fees` op bij een buy (`.plus(fees)`),
  de assets-query niet — dus zelfs voor kale buy/sell-only posities kan het getal afwijken.
  **Voorstel:** trek de cashflow-opbouw (welke transactietypes, welk teken, fees wel/niet)
  naar één functie in `lib/finance/` en laat zowel asset- als portfolio-niveau die
  hergebruiken. Voorkomt dat de twee logica's uit elkaar blijven lopen.

- [x] **F-2: Portfolio-XIRR heeft geen minimale-periode-guard**
  `getAssetWithCalculations` toont pas een XIRR na `XIRR_MIN_DAYS = 30`
  (`assets.ts:442,449`) — precies om te voorkomen dat een kort-lopende positie
  een absurd geannualiseerd getal toont (zie ook STATUS.md R3: "+3% YTD wordt
  zichtbaar als ~+14%"). De portfolio-XIRR in `PortfolioOverview.tsx:52-57` heeft
  deze guard niet. Een net gestarte portfolio (of een net toegevoegde grote positie)
  kan dus een misleidend hoog/laag jaarlijks rendement tonen op dag 2.
  **Voorstel:** dezelfde 30-dagen-drempel toepassen, idealiter via dezelfde
  gedeelde functie als F-1.

- [x] **F-3: Broker-detailpagina rekent `netto inleg` handmatig uit, los van `calculateNetDeposit`**
  `src/app/portfolio/aandelen-etf/broker/[id]/page.tsx:38-43` telt zelf
  buy-amount minus sell-amount op — zonder fees, zonder `deposit`/`withdrawal`.
  De canonieke `calculateNetDeposit` (`lib/finance/net-deposit.ts`) telt fees wél mee.
  Resultaat: bij posities met transactiekosten (zoals de net toegevoegde
  Apple/Shell-testposities) wijkt "Netto inleg" op de broker-pagina af van
  hetzelfde getal op de portfolio-pagina en de positie-detailpagina.
  **Voorstel:** vervang door `calculateNetDeposit` uit `lib/finance`, per asset
  gegroepeerd — net zoals `PortfolioOverview.tsx:112-115` al doet.

- [x] **F-4: Gesloten (volledig verkochte) posities zijn financieel onzichtbaar**
  Een asset wordt alleen `isActive = false` bij een expliciete delete
  (`assets.ts:324`), nooit automatisch wanneer `quantityHeld` naar 0 zakt na
  een volledige verkoop. Zo'n positie blijft dus in alle tabellen staan met
  `currentValue = 0`. Erger: als de verkoop winstgevend was, is
  `netDeposit = buys − sells` vaak **negatief** (meer ontvangen dan ingelegd).
  Zowel `PortfolioGroupTable.tsx:43` (`pct = netDeposit.gt(0) ? … : null`) als
  de kolomweergave op regel 58/61 tonen dan `—` in plaats van het gerealiseerde
  rendement — een winstgevende, afgesloten positie verdwijnt zichtbaar uit beeld.
  **Voorstel:** twee dingen loskoppelen: (1) toon gesloten posities apart
  ("Gesloten posities", ingeklapt) i.p.v. tussen de actieve, en (2) reken en
  toon gerealiseerd resultaat (`sell-opbrengst − kostprijs op AVCO-basis`)
  in plaats van te gokken op het teken van `netDeposit`.

  > ✅ **Afgerond.** Nieuwe functie `calculateRealizedGain` (AVCO) in
  > `lib/finance/cost-basis.ts`, 6 tests. `quantityHeld`/`realizedGain` worden nu
  > onvoorwaardelijk berekend in `getAssetsWithValues` en `getAssetWithCalculations`
  > (niet meer afhankelijk van een geslaagde live-koersophaling — anders bleef een
  > gesloten positie "onzichtbaar" zodra Yahoo Finance een storing had).
  > `PortfolioGroupTable` en `BrokerPositionsTable` splitsen nu open/gesloten
  > posities en tonen gesloten posities in een ingeklapte `<details>`-sectie met
  > het gerealiseerde resultaat. De positie-detailpagina's (aandelen én crypto)
  > tonen bij een gesloten positie "Gerealiseerd resultaat" i.p.v. een lege
  > "Rendement (totaal)"-tegel. Bijvangst: de onderliggende transactiequery in
  > `getAssetsWithValues` sorteerde niet op datum — onschuldig zolang alleen
  > order-onafhankelijke functies (quantity, saldo) erop draaiden, maar noodzakelijk
  > nu AVCO (wél orde-gevoelig) erbij kwam; toegevoegd.
  >
  > **Terzijde gevonden en apart opgelost:** de dev-server liep tijdens het testen
  > vast op `(EMAXCONN) max client connections reached` — `lib/db/index.ts` maakte
  > bij elke Hot-Module-Reload een nieuwe postgres-pool aan zonder de vorige te
  > sluiten. Verholpen met een HMR-veilige `globalThis`-singleton.

---

## Hoog — navigatie & bruikbaarheid (jouw punten)

> ✅ **N-1, N-2, N-3 zijn afgerond.** Primaire actie is nu `+ Nieuwe positie`
> (`/assets/new?type=stock_etf`), met `+ Broker toevoegen` als secundaire link.
> Brokergroepen in de tabel zijn nu klikbaar naar de broker-detailpagina en
> tonen een subtotaalregel (waarde, netto inleg, W/V, %). Zie
> `types/portfolio.ts`, `PortfolioOverview.tsx`, `PortfolioGroupTable.tsx`.

- [x] **N-1: Hoofdpagina kan geen aandeel toevoegen — alleen een broker**
  De primaire actieknop op `/portfolio/aandelen-etf` is `+ Broker toevoegen`
  → `/portfolio/aandelen-etf/broker/new` (`types/portfolio.ts:24-25`, gebruikt
  in `PortfolioOverview.tsx:185-190`). Er is **geen** knop op deze pagina om
  direct een positie toe te voegen — terwijl die flow wel degelijk bestaat
  (`/assets/new?type=stock_etf&brokerId=...`), maar alleen bereikbaar is via
  de broker-detailpagina, die op zijn beurt niet vanaf de hoofdpagina te
  bereiken is (zie N-2). Dit is precies wat je opmerkte.
  **Voorstel:** twee knoppen naast elkaar: `+ Nieuwe positie` (primair,
  opent brokerkeuze in het formulier zelf) en `+ Broker toevoegen` (secundair,
  tekstlink). Alternatief: laat het positie-formulier zelf "nieuwe broker
  aanmaken" toestaan via een inline select+create, zodat één ingang volstaat.

- [x] **N-2: Broker-groepen in de tabel zijn geen link naar de broker-pagina**
  `PortfolioGroupTable.tsx:37-39` toont de brokernaam als platte tekst
  (`<span>`), niet als `<Link>`. De broker-detailpagina
  (`broker/[id]/page.tsx`) bestaat al, heeft eigen KPI's én een
  "+ Nieuwe positie"-knop — maar is vanaf de hoofdpagina nergens aan te klikken.
  Je kunt er alleen komen via de asset-detailpagina (breadcrumb).
  **Voorstel:** maak de groep-header een `Link` naar
  `/portfolio/aandelen-etf/broker/${brokerId}` (alleen relevant voor
  `stock_etf`; crypto heeft geen walletdetailpagina, dus dit moet conditioneel
  via `config`). Vereist dat `groupKey` in `PortfolioOverview.tsx:117-129`
  ook de `brokerId` meegeeft, niet alleen de naam.

- [x] **N-3: Geen totalen per broker op de hoofdpagina**
  Je ziet per broker wél de losse posities, maar geen samengevat "hoeveel heb
  ik hier ingelegd" / "wat is het rendement bij deze broker" zonder door te
  klikken. Die cijfers bestaan al (zie broker-detailpagina, KPI's), maar niet
  als subtotaal-regel in de gegroepeerde tabel op de hoofdpagina.
  **Voorstel:** voeg een subtotaalregel toe onder elke groep in
  `PortfolioGroupTable`: waarde, netto inleg, W/V, % — opgeteld uit de rijen
  van die groep. Scheelt een klik voor het meest gestelde "hoe doet broker X
  het" — en maakt bevinding F-3 direct zichtbaar mocht die blijven bestaan.

---

## Hoog — inzicht in rendement per jaar (jouw punten)

> ✅ **R-1, R-2 zijn afgerond.** Aparte pagina `/portfolio/aandelen-etf/rendement`
> met staafgrafiek (€/%-toggle), gelinkt vanaf de hoofdpagina. KPI-labels op de
> hoofdpagina hernoemd naar "Totaalrendement" / "Rendement (XIRR)" met
> verduidelijkende subtekst — geen hover-tooltip (expliciet feedback: moet
> direct zichtbaar zijn, niet achter mouse-over).
>
> **Methodologie werd tijdens het testen alsnog bijgesteld.** Het oorspronkelijke
> plan (niet-geannualiseerd holding-period-rendement via één `calculateTwr`-periode
> per jaar) bleek zelf ook een timing-vertekening te hebben: die formule behandelt
> élke cashflow alsof die aan het eind van het jaar plaatsvond, wat het rendement
> fors overschat bij een portefeuille met inleg verspreid over het jaar (precies
> deze testdata — bijna elke maand een aankoop). Vervangen door de
> **Modified Dietz-methode** (industriestandaard voor dit exacte probleem): elke
> cashflow weegt naar hoeveel van de periode er nog over was toen die plaatsvond.
> Resultaat na hand-verificatie tegen de 26 testtransacties: 2023 ging van
> (foutief) 38,72% naar 16,18%, 2024 van 29,79% naar 24,39% — jaren zonder
> verspreide cashflows (2025, 2026) bleven vrijwel ongewijzigd, wat bevestigt dat
> de correctie precies daar aangreep waar de vertekening zat. Zie
> `lib/finance/annual-return.ts` voor de volledige uitleg + 7 tests.
>
> **Bijvangst tijdens verificatie:** een pre-existing bug in `getHistoricalPrices`
> (`lib/services/prices.ts`) kon de hele koersreeks van een ticker laten mislukken
> als de allerlaatste handelsdag een nog niet afgewikkelde (`close: null`) rij
> teruggaf — stil opgevangen, zonder foutmelding. Trof ook de bestaande
> "Portefeuille ontwikkeling"-grafiek en de MSCI World-benchmark op `/vermogen`.
> Gefixt door historische koersen nooit tot en met vandaag op te vragen, maar tot
> 5 dagen terug (live koersen lopen al via een aparte functie).

- [x] **R-1: Rendement-tegels tonen alleen het totaalbeeld, geen jaaropsplitsing**
  Zowel "Rendement (totaal)" als "Rendement" (XIRR) in
  `PortfolioOverview.tsx:153-166` zijn all-time cijfers. Er is geen manier om
  "hoe deed 2023 het" te zien zonder transacties handmatig na te rekenen.
  **Voorstel — twee opties, met een methodologische kanttekening:**

  1. **Dropdown + jaartotalen (snelst te bouwen).** Voeg een jaarselector toe
     boven de KPI-rij; herbereken netto inleg/waarde/rendement voor het
     gekozen jaar.
  2. **Aparte pagina met staafgrafiek per jaar** (bijv. `/portfolio/aandelen-etf/rendement`)
     — prettiger voor trend-vergelijking over meerdere jaren, en logischer
     als je dit later ook bij crypto/vastgoed wilt.

  **Het methodologische probleem dat opgelost moet worden vóór implementatie:**
  Een jaarrendement kun je niet zomaar berekenen door XIRR te draaien op
  alleen de cashflows binnen dat jaar — dat annualiseert een periode die vaak
  al (bijna) een jaar is, en geeft voor het lopende jaar (YTD) juist het
  vervormde effect dat STATUS.md al signaleert (R3: "+3% YTD wordt ~+14%").
  De correcte bouwsteen ligt er al: `calculateTwr` in `lib/finance/twr.ts`
  kan een **niet-geannualiseerd** holding-period-rendement per jaar geven
  (`(eindwaarde − cashflow) / beginwaarde − 1`, één periode, geen chaining).
  Dat vereist wel jaarwisseling-waarderingen (portfoliowaarde op 31 december
  van elk jaar) — die zijn er impliciet via `buildStockPortfolioSeries`
  (`lib/finance/stock-series.ts`), maar niet als losse, opvraagbare functie.
  **Let op CLAUDE.md-regel 4:** TWR is nu expliciet gereserveerd voor
  benchmark-vergelijking, XIRR is de primaire KPI. Een niet-geannualiseerd
  jaar-op-jaar-rendement is methodologisch geen "TWR voor benchmarking" én
  geen "XIRR" — het is een derde, apart te labelen getal
  ("Rendement dit kalenderjaar", generieke holding-period-return). Dit moet
  expliciet besloten worden (bij voorkeur samen met Panel 1, zie STATUS.md) —
  niet stilzwijgend een van de twee bestaande labels hergebruiken, anders
  ontstaat precies de verwarring die regel 4 wil voorkomen.

- [x] **R-2: "Rendement (totaal)" en "Rendement" naast elkaar zijn voor een
  eindgebruiker niet vanzelfsprekend te onderscheiden**
  Beide tegels heten "Rendement", beide tonen een percentage, maar het zijn
  fundamenteel verschillende metrieken: totaal-% sinds start vs. jaarlijks
  geannualiseerd (XIRR). Zonder uitleg is het aannemelijk dat een gebruiker
  denkt dat het dezelfde soort getal is, alleen anders weergegeven.
  **Voorstel:** een klein infotooltip-icoontje (ⓘ) bij beide tegels met één
  zin uitleg, of duidelijkere labels: "Totaalrendement sinds start" vs.
  "Rendement per jaar (XIRR)".

---

## Middel — duidelijkheid & consistentie

- [x] **M-1: `AllocationBreakdown` gebruikt 5 kleuren — designsysteem staat max 2 toe**
  `src/components/portfolio/AllocationBreakdown.tsx:9-15` cyclet door
  `steel, sage, terracotta, gold, muted-foreground/40`. CLAUDE.md: "Grafieken:
  max 2 kleuren, sage primair, blauw secundair" en "terracotta: nooit
  standaard rood/negatief-kleur voor iets anders gebruiken". Hier wordt
  terracotta — elders altijd "verlies/negatief" — gebruikt als neutrale
  sector-kleur. Bij een sector die toevallig terracotta krijgt, oogt die
  optisch als "slecht presterend" terwijl het puur een categorie-kleur is.
  **Voorstel:** herzie het kleurenschema voor deze component samen met de
  designer-richtlijn — bijvoorbeeld tinten van sage/steel i.p.v. een 5-kleuren
  categorische palette, of bevestig bewust een uitzondering voor
  allocatie-grafieken (die per definitie >2 categorieën hebben) en documenteer
  dat in `docs/frontend.md`.

- [x] **M-2: Broker verwijderen waarschuwt niet voor het effect op posities**
  `DeleteBrokerButton.tsx:11` vraagt alleen "Broker 'X' verwijderen?" —
  niet dat gekoppelde posities (`stockEtfDetails.brokerId` is
  `onDelete: 'set null'`, schema.ts:110) niet verwijderd worden maar naar
  "Overig" vallen. Voor een gebruiker die per ongeluk een broker met 5 posities
  verwijdert is dat verwarrend: de posities lijken "verdwenen" tot je "Overig" opent.
  **Voorstel:** pas de confirm-tekst aan als er posities aan hangen:
  "Broker 'X' verwijderen? De N posities blijven bestaan onder 'Overig'."

- [x] **M-3: `brokers`-tabel ontbreekt nog steeds in `rls.sql`** (herbevestiging van
  Panel 4, F-4.10 — nog open)
  `src/lib/db/rls.sql` heeft voor elke tenant-gebonden tabel `ENABLE ROW LEVEL
  SECURITY` + policies, behalve `brokers`. Nu we actief op deze tabel bouwen
  (net 2 test-brokers aangemaakt) is dit een goed moment om het mee te pakken:
  applicatiecode filtert wel correct op `tenantId`
  (`lib/db/queries/brokers.ts`), maar dat is — per CLAUDE.md regel 5 — een
  laag bovenop RLS, geen vervanging. Zonder RLS is er geen backstop als de
  Data API (PostgREST) ooit direct tegen `brokers` gebruikt wordt.
  **Voorstel:** policies toevoegen volgens hetzelfde `tenant_id IN (...)`-patroon
  als `liabilities` (schema.ts:211, rls.sql:429-446), aangezien `brokers`
  net als `liabilities` direct een `tenant_id`-kolom heeft (geen omweg via assets).

---

## Laag — polish

- [x] **L-1: `KpiCard` rendert een lege `<p>` als `trend.value` een lege string is**
  Overal in deze pagina wordt `trend={{ value: '', positive: … }}` gebruikt
  puur voor de kleur — `KpiCard.tsx:13-17` rendert dan een leeg paragraafje
  dat toch ruimte inneemt. Optisch onschuldig, maar overbodige DOM/witruimte.
  **Voorstel:** `trend` in `KpiCard` accepteren zonder verplichte `value`, of
  `value` weglaten als die leeg is.

- [x] **L-2: Ticker-badges in `BrokerPositionsTable` vs. platte tekst in
  `PortfolioGroupTable`**
  De broker-detailpagina toont de ticker als een klein gestileerd badge
  (`BrokerPositionsTable.tsx:68-71`), de hoofdpagina toont 'm als kleine
  grijze tekst onder de naam (`PortfolioGroupTable.tsx:52`). Niet fout, maar
  inconsistent — twee visuele stijlen voor hetzelfde gegeven op dezelfde
  informatiereis (hoofdpagina → broker → positie).
  **Voorstel:** hergebruik dezelfde badge-stijl op de hoofdpagina voor
  herkenbaarheid.

---

## Samenvatting: wat raakt wat

De kritieke bevindingen (F-1 t/m F-4) en de jaarrendement-vraag (R-1) raken
allemaal dezelfde kern: **er is nu meer dan één plek die zelf XIRR/netto-inleg
uitrekent**, terwijl CLAUDE.md juist voorschrijft dat `lib/finance/` de bron
van waarheid is. Vóór R-1 (jaarrendement) gebouwd wordt, is het verstandig om
eerst F-1/F-2/F-3 op te lossen door één gedeelde cashflow-opbouwfunctie te
maken — anders krijg je straks een jaaroverzicht dat weer een eigen (vierde)
interpretatie van "welke transacties tellen mee" bevat.

**Voorgestelde volgorde:**
1. ~~N-1, N-2, N-3~~ ✅ **afgerond** (navigatie — quick win, geen afhankelijkheden)
2. ~~F-1, F-2, F-3~~ ✅ **afgerond** (gedeelde cashflow-functie `lib/finance/xirr-cashflows.ts`,
   hergebruikt door asset-XIRR, portfolio-XIRR, `/vermogen` én de broker-detailpagina)
3. ~~F-4~~ ✅ **afgerond** (gesloten posities apart + gerealiseerd resultaat via nieuwe
   `calculateRealizedGain`; onderweg ook een HMR-connectiepool-lek in `lib/db/index.ts` gefixt)
4. ~~R-1, R-2~~ ✅ **afgerond** (rendement-per-jaar-pagina met staafgrafiek,
   Modified Dietz-methodologie, duidelijkere KPI-labels)
5. **M-1, M-2, M-3, L-1, L-2 — enige nog openstaande punten.** Allemaal
   polish/consistentie, geen financiële correctheid, geen onderlinge
   afhankelijkheden — kunnen in willekeurige volgorde. M-3 (RLS op `brokers`)
   is het enige met een veiligheidsaspect, dus als je moet kiezen: die eerst.

**Apart genoteerd, niet in deze lijst:** `/vermogen`'s `AllocationChart` crasht in de
browser doordat een `Decimal`-object (i.p.v. `number`) van server naar client component
gaat — bestaande bug, losstaand van aandelen/ETF, wordt apart opgepakt.
