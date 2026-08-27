# Stappenplan — Financiële overzichten

**Status:** deel A en deel C (C1-C10) volledig afgerond en getest — dit
document is inhoudelijk klaar.
**Secties:** `/`, `/cashflow`, `/portfolio` en alle subpagina's daaronder
**Leidraad:** het perspectief van een financieel adviseur voor particulieren.
[`financial-expert.md`](financial-expert.md) blijft het inhoudelijke
toetsingskader voor elk cijfer in de app — dit document is de uitvoering
daarvan, in volgorde.

Dit bestand vervangt vijf losse stappenplannen die tijdens de analyse zijn
ontstaan (`stappenplanCashflowOverzicht.md`, `stappenplanOverallOverzicht.md`,
`stappenplanPortfolioOverzicht.md`, `stappenplanVastgoed.md`,
`stappenplanAssetKoppeling.md`) — samengevoegd tot één geheel in bouwvolgorde,
zodat er nog maar één document is om puntsgewijs af te vinken. De originelen
zijn verwijderd.

**Rolverdeling tussen de drie overzichtspagina's** (uitgangspunt voor alles
hieronder): **Cashflow** = geldstromen & de gezondheid daarvan (kom ik rond,
houd ik genoeg over). **Portfolio** = vermogen & rendement (hoe presteert
wat ik heb opgebouwd, hoe is het verdeeld). **Startpagina** = triage (hoe
staat het er op hoofdlijnen voor, waar moet ik als eerste kijken) — geen
derde kopie van de andere twee.

---

## Deel A — Afgerond

### [x] A1. Cashflow — Financiële gezondheid (spaarquote, buffer, dekkingsgraad)

Drie pure functies in `src/lib/finance/` (`savings-rate.ts`,
`buffer-coverage.ts`, `passive-income-coverage.ts`), tests in
`finance.test.ts`. Zichtbaar op `/cashflow` als eerste sectie "Financiële
gezondheid", vóór de rest van de pagina — eerst gezondheid, dan detail.

- **Spaarquote:** `netMonthlyCashflow / monthlyIncome`. Vuistregel ≥20%.
- **Buffer-dekking:** `liquide spaarsaldo / monthlyExpenses`, in maanden.
  Kwalitatief label: <3 mnd "krap", 3-6 "gezond", >6 "ruim"
  (`classifyBufferMonths`).
- **Dekkingsgraad passief inkomen:** `bruto passief inkomen (YTD, herleid
  naar maand) / monthlyExpenses`. Alleen getoond bij ≥1 maand aan data
  (voorkomt vertekening begin januari, zelfde voorzichtigheid als bij korte
  XIRR-periodes).

Alle drie geven `null` terug bij een ontbrekende basis (geen `0`/`NaN`),
consistent met `calculatePercentChange`.

### [x] A2. Cashflow — kleine correcties

- Label "Passief inkomen dit jaar" → "Bruto passief inkomen dit jaar"
  (bestaande subtext "excl. hypotheeklasten" bleef staan).
- "Eenmalige uitgaven dit jaar" kreeg een tweede KPI ernaast: "Cashflow dit
  jaar incl. eenmalige uitgaven", met het volledige sommetje in de subtext
  (`€netto cashflow − €eenmalige uitgaven = €resultaat`).

### [x] A3. Cashflow — dubbele vermogensweergave verwijderd

"Netto vermogen groei dit jaar"-KPI en de `NetWorthChart`-tijdlijn hoorden
niet op Cashflow thuis (vermogens-metriek, geen geldstroom) én stonden al
rijker op `/portfolio`. Verwijderd uit `src/app/cashflow/page.tsx`, incl.
alle queries die alleen daarvoor bestonden (`getNetWorthAtDate`,
`getValuationTimeSeries`, `getMortgageBalanceTimeSeries`,
`getAssetsWithValues`, `getMortgageBalancesMap`, `getLiabilities`) en
finance-aanroepen (`calculateNetWorth`, `buildNetWorthSeries`).

### [x] A4. Startpagina — aandachtspunt-signaal

`determineFinancialHealthSignal` in
`src/lib/finance/financial-health-signal.ts` bepaalt het meest urgente
signaal uit spaarquote + buffer-dekking (dekkingsgraad passief inkomen doet
hier bewust niet aan mee, zie Deel B). Prioriteit: buffer "krap" > negatieve
spaarquote > bevestigend bericht ("✓ Financieel gezond: ...") > geen signaal
bij te weinig data. De functie geeft alleen cijfers + urgentie-type terug —
de Nederlandse tekst wordt in `page.tsx` (`healthSignalText`) samengesteld,
buiten de financiële laag. Zichtbaar als kaart direct onder de
"Netto vermogen"-kaart op `/`.

**Alle vier:** `tsc`, `eslint` en Vitest (184/184) groen.

---

## Deel B — Vastgelegde afspraken (geen bouwwerk)

Beslissingen die tijdens de analyse zijn genomen en die toekomstig werk
moeten voorkomen dat de verkeerde vraag opnieuw stelt:

- **Rental-inkomen bewust in twee systemen loggen:** als recurring item
  onder vaste lasten & inkomsten (voedt spaarquote/netto cashflow — de
  huishoudbudget-vraag) én als transactie bij het vastgoed-asset (voedt
  XIRR/rendement en de passief-inkomen-tegels — de rendementsvraag). Geen
  dubbeltelling: de twee bronnen worden nergens bij elkaar opgeteld.
- **Dekkingsgraad passief inkomen blijft op Cashflow**, en doet bewust niet
  mee aan het startpagina-signaal (A4): het is een voortgangsmetriek ("hoe
  dicht bij financiële onafhankelijkheid"), geen risicosignaal. Toekomstige
  natuurlijke plek voor "hoe dicht bij FI": het **"Actief doel"-blok**
  zodra Sprint 4 (doelen-datamodel) wordt opgepakt — zie C10.
- **Vermogensontwikkeling (tijdlijn) woont bij Portfolio**, niet bij
  Cashflow of de startpagina — zie A3.

---

## Deel C — Te bouwen, in volgorde

### [x] C1. Portfolio — XIRR/TWR-disclaimer + XIRR-periode zichtbaar

**Waarom eerst:** tekst-only, geen open beslissingen, laagste risico van
alle punten hieronder.

- **Disclaimer** (`financial-expert.md` §2c, "grootste risico in de app"):
  "Rendement dit jaar" (XIRR) en "Marktrendement" (TWR) staan naast elkaar
  zonder toelichting dat dit twee verschillende grootheden zijn — timing
  van stortingen kan XIRR sterk vertekenen t.o.v. TWR. Vaste disclaimer-
  tekst toevoegen: *"Dit vergelijkt jouw persoonlijk rendement (XIRR) met
  de marktprestatie (TWR). Timing van stortingen beïnvloedt dit getal
  sterk."*
- **Periode:** subtext van "Rendement dit jaar" uitbreiden met de periode
  (bijv. "XIRR sinds 1 jan 2026"). `ytdStart` is al beschikbaar in
  `src/app/portfolio/page.tsx`.

**Bestand:** `src/app/portfolio/page.tsx`. Geen nieuwe berekening, geen
nieuwe query.

---

### [x] C2. Asset-koppeling — alle vijf categorieën in één bouwronde

**Status: gebouwd.** Nieuw gedeeld component
`src/components/portfolio/AssetPositionsCard.tsx` toont per lijstpagina de
asset-gebaseerde posities van dat type (naam, waarde, link naar
`/assets/[id]`) plus een knop om een vol asset aan te maken — uitgerold
over alle vijf pagina's (`vastgoed`, `aandelen-etf`, `crypto`,
`spaarrekeningen`, `pensioen`). `/assets/[id]` stuurt nu door naar
`/portfolio/vastgoed/[id]` zodra `assetType === 'real_estate'`. `tsc`,
`eslint`, Vitest (184/184) groen.

**Hoofdbevinding (kern van dit hele punt):** voor Vastgoed, Aandelen & ETF,
Crypto, Spaarrekeningen en Pensioen bestaan twee ontkoppelde systemen —
een simple-entry lijst (zichtbaar via het Portfolio-menu) en een volwaardig
asset-systeem (transacties, XIRR, bij vastgoed ook huurrendement/cash-on-
cash/LTV). Het asset-systeem is in de praktijk **onvindbaar**: geen enkele
lijstpagina linkt naar asset-gebaseerde posities, en `/assets` (waar je een
vol asset aanmaakt) staat niet in de Topbar-navigatie. Dit is de directe
oorzaak van "waarom komt er geen getal te staan bij passief inkomen" — niet
alleen voor vastgoed, voor elke assetklasse.

Bevestigd per categorie: alleen **Vorderingen** is hier niet door geraakt
(geen simple-entry-variant, dus maar één systeem — geen actie nodig).
**Vastgoed** heeft bovendien een extra laag: een eigen, nergens-gelinkte
detailpagina (`/portfolio/vastgoed/[id]`) met rendementscijfers die de
andere vier categorieën niet hebben (die tonen al wel "ingelegd vs. huidige
waarde" + een grafiek op de simple-entry-pagina zelf, dus minder kaal dan
vastgoed was).

**Actie (mechanisch identiek over alle vijf pagina's, dus in één ronde
bouwen, idealiter als gedeeld component):**
1. Elke lijstpagina (`/portfolio/vastgoed`, `/portfolio/aandelen-etf`,
   `/portfolio/crypto`, `/portfolio/spaarrekeningen`, `/portfolio/pensioen`)
   toont naast de simple-entry-rijen ook eventuele asset-gebaseerde posities
   van hetzelfde type (`getAssetsWithValues` gefilterd op `assetType` —
   bestaat al, zelfde patroon als `/assets/page.tsx`), elk met een link naar
   hun detailpagina.
2. Elke lijstpagina krijgt een zichtbare link naar "vol asset aanmaken"
   (`/assets/new?type=<categorie>`), naast het bestaande simple-entry-
   formulier.

**Twee beslissingen vooraf nodig:**
- [ ] `/assets/[id]` laten doorverwijzen naar `/portfolio/vastgoed/[id]`
      zodra `assetType === 'real_estate'` (voorkeur: **ja** — twee
      detailpagina's voor dezelfde asset-klasse in stand houden is precies
      het patroon dat tot dit probleem leidde). Voor de overige vier
      categorieën is `/assets/[id]` sowieso de enige detailpagina, dus daar
      speelt deze vraag niet.
- [ ] Eén gedeeld component voor "asset-gebaseerde posities tonen" over de
      vijf pagina's, of per categorie losse implementatie (voorkeur:
      **gedeeld**, gezien de identieke structuur).

**Bestanden:** de vijf `src/app/portfolio/<categorie>/page.tsx`, plus
`src/app/assets/[id]/page.tsx` voor de redirect. Geen nieuwe `lib/finance`-
functies nodig — puur ontsluiting van bestaande data.

---

### [x] C3. Portfolio — liquide-only allocatieweergave

**Status: gebouwd.** `AllocationChart` toonde alleen totale vermogens-
allocatie incl. vastgoed en pensioen — zodra vastgoed 90%+ van het vermogen
uitmaakt (niet ongebruikelijk bij een eigen woning), zegt die grafiek
vrijwel niets over beleggingskeuzes (`financial-expert.md` §1c).

Toggle boven de grafiek ("Totaal" / "Liquide", zelfde tab-stijl als de
Aankoop/Verkoop-tabs bij transacties) i.p.v. twee grafieken naast elkaar —
gekozen om de toch al dichte Portfolio-pagina niet drukker te maken
(designsysteem: max 2 kleuren, geen overladen UI). Toggle verschijnt alleen
als de liquide selectie daadwerkelijk minder categorieën bevat dan het
totaal — bij een puur liquide portfolio is er niets te schakelen.

`src/app/portfolio/page.tsx` berekent nu twee slice-sets
(`allocationSlices`/`liquidAllocationSlices`, beide via
`getPortfolioCategoryTotals` + `calculateAllocation`, filter op `c.liquid`
voor de tweede) en geeft ze als `slices`/`liquidSlices` mee aan
`AllocationChart`, die zelf de actieve view bijhoudt (`useState`). Geen
nieuwe `lib/finance`-functie nodig — puur filteren van bestaande data.
`tsc`/`eslint`/Vitest (208/208) groen.

---

### [x] C4. Asset-koppeling vervolg — pensioen-XIRR uitsluiten

**Status: bleek al opgelost, geen code nodig.** Het idee was een
voorwaarde toe te voegen op `/assets/[id]` om XIRR te verbergen voor
`assetType === 'pension'` (`financial-expert.md` §4d: pensioen is niet
vrij opneembaar, een XIRR erop geeft een vals gevoel van precisie).

Gecontroleerd bij de start van dit punt: `/portfolio/pensioen/[id]` (de
specialized detailpagina die tijdens C2 werd gebouwd) toont sowieso al
nooit XIRR — alleen "Opgebouwde waarde" en "Verwachte jaaruitkering". En
`/assets/[id]` stuurt elke `pension`-asset sinds de C2-fix altijd door naar
die specialized pagina, dus de generieke XIRR-weergave wordt voor pensioen
nooit meer bereikt. `getAssetWithCalculations` berekent XIRR nog wel voor
elke asset (inclusief pensioen, onschuldig — puur ongebruikte data), maar
dat wordt nergens getoond. `AssetPositionsCard` (de lijstpagina) toont ook
geen XIRR, alleen naam en waarde. Geen wijziging nodig.

---

### [x] C5. Vastgoed-detailpagina — hefboom-disclaimer + periode

**Status: gebouwd.** Twee kleine tekstcorrecties op `/portfolio/vastgoed/[id]`:

- **Periode bij huurrendement — bleek al gebouwd**, als bijvangst van de
  eerdere "laatste jaar mét data"-fix (zie C7-vervolgcorrecties):
  bruto/netto huurrendement en cash-on-cash tonen al `rentalDataYear` in de
  subtext ("Jaarinkomen 2024 / pandwaarde" e.d.). Geen actie nodig.
- **Hefboom-disclaimer** (`financial-expert.md` §2d) — toegevoegd: *"Cash-
  on-cash is hoog door de hypotheekfinanciering — dit vergroot zowel winst
  als verlies."* Alleen zichtbaar als er zowel een cash-on-cash-cijfer als
  daadwerkelijk hypotheekschuld is (anders is er geen hefboom om voor te
  waarschuwen). `tsc`/`eslint` groen.

---

### [x] C6. Portfolio — netto inleg vs. huidige waarde KPI

**Status: gebouwd.** Nieuwe KPI-kaart "Ingelegd vs. huidige waarde" op
`/portfolio`, onder de bestaande 4-KPI-rij en de XIRR/TWR-disclaimer —
tastbaarder voor een particulier dan een XIRR-percentage; een adviseur laat
dit vaak eerst zien. Waarde toont de huidige waarde (primair getal, zoals
de andere KPI's op deze pagina), subtext toont het ingelegde bedrag, trend
toont het verschil in € en % (sage bij winst, terracotta bij verlies).

**Scope-besluit (met de gebruiker afgestemd):** alleen liquide posities
(aandelen/crypto/spaargeld) — consistent met "Liquide vermogen" en
"Rendement dit jaar", die op dezelfde pagina al liquide-only zijn. Bij
vastgoed is "ingelegd" de eigen inbreng ex hypotheek (hefboom), een ander
soort getal dan liquide cash-inleg — samen optellen zou appels met peren
mengen (zelfde reden waarom portfolio-XIRR al liquide-only was).

**Bouw:** `calculateNetDeposit` bestond al (per-asset, in `getLiquidAssets-
WithCalculations`) — hier alleen opgeteld over alle liquide posities
(`liquidAssets.reduce(...)`), samen met de al-bestaande `totalLiquidTracked`
voor de huidige waarde. Geen nieuwe `lib/finance`-functie nodig.
`tsc`/`eslint`/Vitest (208/208) groen.

---

### [x] C7. Lot van de simple-entry-lijst — vastgoed + de overige vier

**Status: vastgoed opgelost, met echt gebruik ervoor in de hand — de
voorkeursoptie uit dit plan bleek achteraf de verkeerde.** Bij het eerste
echte pand-toevoegen bleek de eenvoudige WOZ-lijst geen scenario te dekken
dat het volledige systeem niet ook dekt — ook "eigen woning zonder
verhuur" werkt prima via het volle systeem (propertyType = "Eigen woning",
gewoon geen huurtransacties invoeren; de pagina toont dan vanzelf
marktwaarde/hypotheekschuld/eigen vermogen/LTV in plaats van
huurrendement). **Besluit: uitgefaseerd, niet naast elkaar gehouden.**

Uitgevoerd:
- UI verwijderd van `/portfolio/vastgoed` (formulier + lijst)
- Query-/action-functies verwijderd (`get/create/update/deleteRealEstateEntry`
  uit `simple-entries.ts` en `simple-entry-actions.ts`)
- Referenties verwijderd uit `portfolio-summary.ts` en de startpagina
- `real_estate_entries`-tabel gedropt (migratie `0021_drop-real-estate-entries.sql`,
  0 rijen aanwezig — geen dataverlies), RLS-policies verwijderd uit `rls.sql`,
  `docs/project files/data-model.md` bijgewerkt
- `tsc`/`eslint`/Vitest (178/178, 6 minder dan voorheen — precies de
  verwijderde functies, zie `tenant-scoping.test.ts`) groen

**Vervolgcorrecties na eerste echt gebruik:**
- Bug gevonden: "Totale waarde" bleef leeg na het aanmaken van een pand —
  vastgoed heeft geen "buy"-transactieflow zoals aandelen (huidige waarde
  komt uit `asset_valuations`), dus zonder handmatige waardering bleef de
  waarde op 0 staan terwijl de aankoopprijs al bekend was. Fix: aankoopprijs
  wordt nu automatisch de eerste waardering, op de aankoopdatum
  (`createAssetAction` in `src/app/assets/actions.ts`).
- Terminologie herzien: "Posities met transacties" / "+ Pand met
  transacties toevoegen" paste niet meer — voor vastgoed bestaat de
  dual-system-afweging niet meer (na uitfaseren hierboven), dus die framing
  was overbodig jargon. Nieuw, vastgoed-specifiek component
  `RealEstatePositionsCard` met gewoon "Jouw panden" / "+ Pand toevoegen".
  De generieke `AssetPositionsCard` blijft ongewijzigd voor de andere vier
  categorieën, waar de dual-system-afweging wél nog bestaat.
- Meer informatie per pand op verzoek: WOZ-waarde, restant hypotheek, en
  (alleen bij `propertyType === 'rental'`) huurinkomsten en kosten dit jaar
  — rechtstreeks in de lijst op `/portfolio/vastgoed`, niet pas na doorklikken.
  Weergave uiteindelijk als echte tabel met kopregels i.p.v. kaarten (op
  verzoek, oogde eerst slordig).
- Detailpagina (`/portfolio/vastgoed/[id]`) doorgelicht op "eigen woning"-
  weergave: LTV bevestigd als terecht ook voor eigen woning (renteklasse
  vaak LTV-gekoppeld bij NL hypotheekverstrekkers). WOZ-waarde ontbrak
  volledig (wel opgeslagen, nooit getoond) en hypotheekrente stond verstopt
  als kleine subtext in het saldo-formulier — beide nu een zichtbaar
  "Details"-blok direct onder de KPI's (WOZ-waarde, verstrekker, rente,
  hypotheekvorm, looptijd).
- **Rente/aflossing per jaar — gebouwd.** Nieuwe pure functie
  `calculateMortgageAmortizationForYear` in
  `src/lib/finance/mortgage-amortization.ts` (8 tests, incl. annuïteit/
  lineair/aflossingsvrij en randgevallen vóór start / na volledige
  afbetaling). Simuleert het aflossingsschema maand voor maand puur op
  basis van de hypotheekvoorwaarden (rente, vorm, bedrag, looptijd via
  `startDate`/`endDate`) — geen saldo-historie nodig. Zichtbaar in het
  Details-blok op `/portfolio/vastgoed/[id]` als "Rente {jaar} (geschat)"
  en "Aflossing {jaar} (geschat)", met een disclaimer dat extra
  aflossingen buiten het schema niet zijn meegerekend. `tsc`/`eslint`/
  Vitest (186/186) groen.
- **Waarde-/saldohistorie op regelniveau bewerkbaar en verwijderbaar
  gemaakt**, net als de cashflow-tabellen (potlood = inline bewerken met
  Opslaan/Annuleren, prullenbak = verwijderen), i.p.v. kale, niet-
  interactieve regels. Nieuwe query-functies `updateValuation` en
  `updateMortgageBalance` (bestonden alleen als create/delete) + bijbehorende
  server actions. Delete-acties omgezet van een harde `redirect()` naar
  `revalidatePath()` (zoals de cashflow-tabellen al deden) — geen page-
  reload meer bij bewerken/verwijderen. `ValuationHistory` en
  `MortgageBalanceHistory` zijn gedeelde componenten (ook gebruikt door de
  generieke `/assets/[id]`-pagina, dus die profiteert automatisch mee).
  Ook een expliciet potlood-icoon toegevoegd aan de transactielijst (had al
  klik-om-te-bewerken + prullenbak, maar geen zichtbare bewerk-affordance).
  **"Details"-blok bewust ongewijzigd gelaten** — hypotheekvoorwaarden
  (verstrekker, rente, vorm, looptijd) zijn geen historie-lijst; bewerken
  daarvan loopt via de bestaande "Bewerken"-knop bovenaan de pagina, niet
  via regel-niveau iconen. `tsc`/`eslint`/Vitest (190/190) groen.
- **WOZ-waarde krijgt een eigen "bijwerken"-sectie, net als Marktwaarde en
  Hypotheeksaldo** — bleek bij nader inzien wél een historie nodig te
  hebben (verandert jaarlijks via de gemeentelijke WOZ-beschikking), niet
  alleen een eenmalig veld bij aanmaken. Nieuwe tabel `woz_values`
  (migratie `0022_add-woz-values.sql`) — bewust apart van `asset_valuations`:
  WOZ (gemeentelijke taxatie) en marktwaarde (eigen inschatting) zijn
  verschillende grootheden die uit elkaar kunnen lopen. Zelfde
  "laatste rij = huidige waarde"-patroon, met terugval op het bij aanmaken
  ingevoerde bedrag zolang er nog geen historie is (identiek aan hoe
  hypotheeksaldo terugvalt op `originalAmount`). Nieuwe query-functies
  (`create/update/deleteWozValue`), server actions, en `WozValueForm`/
  `WozValueHistory`-componenten — zelfde inline-bewerken-met-iconen-patroon
  als de rest van deze sectie. RLS-policies toegevoegd. **Vereist actie:**
  de migratie moet nog in de Supabase SQL Editor uitgevoerd worden (zie
  onder). `tsc`/`eslint`/Vitest (195/195) groen. Tijdens het bouwen kwam er
  kort een `ReferenceError` voorbij in de dev-server-log door een
  hot-reload-cachingprobleem (niet een echte codefout — bevestigd via de
  regelnummers in de foutmelding, die niet meer overeenkwamen met het
  huidige bestand) — inmiddels vanzelf opgelost door latere recompiles;
  een harde refresh (Ctrl+Shift+R) lost dit sowieso op als het nog ergens
  hangt.
- **Bug gevonden: rente/aflossing (zie hierboven) bleek in de praktijk
  nooit zichtbaar** — de berekening heeft de hypotheek-einddatum nodig om
  de looptijd te bepalen, maar het aanmaak-/bewerkformulier had daar nooit
  een veld voor. Twee fixes:
  1. "Einddatum (looptijd)" toegevoegd aan de Hypotheek-sectie in
     `AssetForm.tsx`, met een korte uitleg waarom dat nodig is.
  2. **Groter, apart gevonden gat:** `updateAsset` (het "Bewerken"-formulier)
     sloeg hypotheekgegevens helemaal nooit op — het formulier toonde ze wel
     vooringevuld, maar wijzigingen aan verstrekker/rente/vorm/looptijd
     verdwenen stil bij opslaan. Nu een echte upsert: bestaande hypotheek
     bijwerken, of aanmaken als het pand er nog geen had. Zonder deze fix
     kon een al aangemaakt pand de ontbrekende einddatum ook nooit met
     terugwerkende kracht krijgen.
  `tsc`/`eslint`/Vitest (195/195) groen. **Actie voor jou:** ga naar je
  bestaande pand → Bewerken → vul de einddatum in en sla op, dan verschijnen
  Rente/Aflossing alsnog.
- **Huurrendement/cash-on-cash toonden "—"/0% bij een verhuurpand met
  correct ingevulde data.** Root cause via read-only data-check gevonden:
  de berekening filterde transacties op "dit kalenderjaar"
  (`transactionDate >= 1 jan huidig jaar`) — bij historische/test-invoer
  (transacties uit 2020/2022) valt dat altijd buiten de boot, en zelfs met
  actuele invoer breekt dit elk jaar opnieuw rond 1 januari tot de eerste
  transactie van het nieuwe jaar is ingevoerd. Fix: bruto/netto
  huurrendement en cash-on-cash gebruiken nu **het laatste jaar mét
  transacties** (afgeleid van `cashflowByYear`, dezelfde bron als de
  "Cashflow per jaar"-tabel op dezelfde pagina) i.p.v. hardcoded het huidige
  jaar. KPI-subtext toont nu ook expliciet welk jaar het cijfer betreft.
- **Losstaande bug, in dezelfde ronde gevonden:** "Hypotheekschuld" op deze
  pagina viel terug op €0 zodra er nog geen saldo-snapshot was ingevoerd
  (i.p.v. het oorspronkelijke hypotheekbedrag), waardoor eigen vermogen/LTV
  te gunstig oogden. Elders in de app (`getMortgageBalancesMap`) heeft
  dezelfde berekening al wél deze fallback — hier ontbrak hij. Gefixt.
  `tsc`/`eslint`/Vitest (195/195) groen.
- **Herhalende transactie toevoegen** — bij het invoeren van maandelijkse
  huur/VvE-kosten bleek er geen manier te zijn om een terugkerende
  transactie te registreren (in tegenstelling tot "vaste lasten &
  inkomsten" op Cashflow, die wel een frequentie-veld heeft). Bewust géén
  nieuwe "recurring"-abstractie gebouwd — dat zou XIRR/rendement/cashflow-
  per-jaar allemaal moeten leren omgaan met een nieuw concept. In plaats
  daarvan: een "Herhaal deze transactie automatisch"-optie op het
  transactie-aanmaakformulier (alleen bij nieuw, niet bij bewerken) die in
  één keer meerdere losse, normale `transactions`-rijen aanmaakt (frequentie
  maandelijks/4-wekelijks/per kwartaal/jaarlijks, 1-60 herhalingen). Elke
  gegenereerde transactie is daarna gewoon individueel te bewerken/
  verwijderen via de bestaande transactielijst — geen speciale status, dus
  alle bestaande berekeningen werken ongewijzigd. `tsc`/`eslint`/Vitest
  (195/195) groen.
- **Aankoop/Verkoop bij vastgoed opgeschoond, plus een financieel-
  correctheidsgat gevonden.** Aanleiding: het aantal/koers-invoer bij
  "Aankoop" hoort bij aandelen/crypto, niet bij een pand. Fix:
  `TransactionForm` toont die velden nu alleen nog voor `stock_etf`/`crypto`
  (nieuwe `assetType`-prop, doorgegeven vanaf beide aanroeiplekken).
  **Onderweg bleek "Aankoop" bij vastgoed niet overbodig maar juist
  verplicht**: Totaalrendement (XIRR) rekent met alle transacties plus de
  huidige eigen-vermogenswaarde als eindpunt, maar zonder een
  "Aankoop"-transactie ontbreekt het startpunt (de eigen inbreng) volledig
  — XIRR overschat het rendement dan enorm, alsof er met €0 is gestart. Dit
  stond nergens uitgelegd. Fix: label wordt bij vastgoed "Eigen inbreng (bij
  aankoop)" / "Verkoopopbrengst" i.p.v. "Aankoop"/"Verkoop", met een
  toelichting bij het bedragveld waarom dit nodig is voor een kloppende
  XIRR. Geen automatische berekening (bewust gekozen, blijft handmatige
  transactie — zie ook stappenplan-vraag over of dit ooit automatisch moet).
- **"Rekening verwijderen" klopte niet voor vastgoed** (en evenmin voor
  crypto/spaarrekeningen/pensioen/vorderingen, die hetzelfde component
  delen). `DeleteAssetButton` heeft nu een `label`-prop (default:
  "Verwijderen", generiek correct voor alle typen); vastgoed krijgt expliciet
  "Pand verwijderen".
- **Grotere ontdekking tijdens het uitzoeken: crypto/spaarrekeningen/
  pensioen/vorderingen hebben óók specialized detailpagina's** die niet
  eerder in kaart waren gebracht (`stappenplanAssetKoppeling.md`/C2 ging
  er ten onrechte van uit dat alleen vastgoed er een had — onvolledig
  onderzoek destijds, geen submap-check op de andere categorieën gedaan).
  De lijstpagina van vorderingen linkte hier al correct naartoe; crypto/
  spaarrekeningen/pensioen deden dat niet (linkten naar de kale generieke
  `/assets/[id]`-pagina, exact het "onvindbaar gekoppeld"-patroon van
  vastgoed vóór de C2-fix). Opgelost — niet door `AssetPositionsCard` aan
  te passen, maar simpeler: de doorverwijzing in `/assets/[id]/page.tsx`
  (eerder alleen voor `real_estate`) uitgebreid naar alle vijf typen met een
  specialized pagina. Alle vier detailpagina's hebben een vaste terug-link
  (geen `from`-parameter nodig), dus geen verdere wijziging elders nodig.
  `tsc`/`eslint`/Vitest (195/195) groen.
- **Doorlopende huur/kosten-periodes toegevoegd** — 12x dezelfde
  rental_income/cost-transactie per jaar los invoeren werd bij een langlopend
  vast huurbedrag al snel een zeer lange lijst. Nieuw: 1 rij per periode
  (vanaf-datum, evt. tot-en-met-datum, bedrag per maand of eenmalig) op de
  vastgoed-detailpagina, i.p.v. elke maand een losse transactie. Verandert de
  huur/VvE-bijdrage? Dan krijgt de oude periode een einddatum en komt er een
  nieuwe rij bij. Nieuwe tabel `recurring_cashflows` (schema.ts, RLS-policies
  in rls.sql, migratie `0023_brief_deathstrike.sql` — **nog uitvoeren in
  Supabase**, zie hieronder), pure rekenfunctie
  `calculateRentalPeriodCashflowForYear` (proportioneert op hele
  kalendermaanden, telt op tot een jaartotaal). Bewuste keuze (met de
  gebruiker afgestemd): bestaande losse rental_income/cost-transacties
  blijven gewoon meetellen — periodes komen er in de jaartotalen
  (huurrendement, cash-on-cash, "Cashflow per jaar") gewoon bovenop, geen
  migratie van bestaande data. De "nieuwe transactie"-flow biedt
  Huurinkomst/Kosten niet meer aan bij vastgoed (alleen nog Aankoop/Verkoop);
  bestaande transacties van dat type blijven gewoon bewerkbaar via de
  edit-pagina. Scope bewust beperkt tot vastgoed (andere assettypes gebruiken
  rental_income/cost niet). `tsc`/`eslint`/Vitest (208/208, +13 nieuwe tests)
  groen.

**Aandelen-etf/crypto/spaarrekeningen/pensioen — status: opgelost, geen
uitfasering.** Hier ligt uitfaseren nog steeds niet voor de hand, want de
simple-entry-pagina's bieden al reëel inzicht (ingelegd/waarde/winst-verlies
+ grafiek) dat het volle systeem niet vervangt zonder meer moeite
(aankoopprijs/-datum verplicht). Besluit: beide laten bestaan. De
ontbrekende UX-tekst ("wanneer welke te gebruiken") is nu toegevoegd: één
regel direct boven het eenvoudige invoerformulier op alle vier pagina's,
per categorie toegespitst op wat het volle systeem daar extra biedt (XIRR +
dividend bij aandelen, alleen XIRR bij crypto, rente-tracking bij sparen,
niets rendementsmatigs bij pensioen — sluit aan bij de al bestaande
`description`-tekst op de `AssetPositionsCard` erboven, die het volle
systeem toelicht). `tsc`/`eslint`/Vitest (208/208) groen.

---

### [x] C8. Portfolio — risicobadges, pensioen apart tonen, data-versheid

**Status: gebouwd**, alle drie punten uit `financial-expert.md` op
`/portfolio`:

- **Risicoprofiel-badges** (§4b) — vast per `assetType` (met de gebruiker
  afgestemd, niet per individuele positie: geen extra invoerveld nodig).
  `RISK_LABELS`-mapping: Aandelen & ETF = "Gemiddeld", Crypto = "Volatiel",
  Sparen = "Veilig", vastgoed/pensioen/vorderingen = geen badge (n.v.t.,
  geen markt-risicoprofiel in die zin). Kleine pill naast de bestaande
  liquide/illiquide-tag op elke categorie-tegel.
- **Pensioen apart tonen** (§4d) — uit de "Categorieën"-grid gehaald, eigen
  kaart eronder met label "niet vrij vermogen" en subtext "Opgebouwde
  aanspraak — telt mee in totale portfoliowaarde, maar niet vrij
  opneembaar". KPI-totalen zelf ongewijzigd (Totale portfoliowaarde hoort
  pensioen terecht mee te tellen; Liquide vermogen sloot het al uit) —
  puur een visuele scheiding, geen rekenkundige.
- **Data-versheid indicator** (§3c) — nieuw veld `lastUpdated` op
  `getPortfolioCategoryTotals` (portfolio-summary.ts): meest recente
  simple-entry-datum plus, voor waarderings-gedreven categorieën
  (vastgoed/pensioen), de meest recente asset-waardering. Bewust **niet**
  berekend voor aandelen-etf/crypto/sparen-als-asset (live koers resp.
  transactie-som, per definitie altijd actueel — alleen de handmatige
  invoerpaden kunnen verouderen). Getoond als "Bijgewerkt: {datum}" op elke
  tegel. Ook een korte toelichting onder de vermogensgrafiek (laatste
  waarderingsdatum + uitleg dat een vlak stuk "geen nieuwe invoer" betekent,
  niet "geen verandering").
  **Bewust niet gebouwd:** per-punt visuele hint ín `NetWorthChart` zelf
  (bijv. gestippelde lijn voor periodes zonder nieuwe waardering) — vereist
  wijzigingen dieper in de chart-rendering voor beperkte meerwaarde bovenop
  de tekstuele toelichting die er nu al staat.

`tsc`/`eslint`/Vitest (208/208) groen.

---

### [x] C9. Cashflow-trendgrafiek

**Status: gebouwd.** Grafiek met inkomen vs. uitgaven per maand (laatste 12
mnd) op `/cashflow`, i.p.v. alleen huidig-moment-KPI's — laat
seizoenspatronen en verbetering/verslechtering zien.

**Bouw:**
- Nieuwe query `getRecurringItemsWithHistory` (`recurring-items.ts`) —
  zelfde als `getRecurringItems` maar met de volledige bedraghistorie i.p.v.
  ingekort tot het huidige bedrag.
- Nieuwe pure functie `buildMonthlyCashflowSeries` +
  `lastNMonths`-hulpfunctie (`src/lib/finance/monthly-cashflow-series.ts`,
  11 tests). Reconstrueert per maand welk bedrag toen gold (laatste
  `effectiveDate` op of vóór die maand, per vast-lasten-item), plus
  eenmalige uitgaven in hun eigen maand — beide met `isShared`-halvering.
  Item bestond nog niet in een maand? Telt dan niet mee.
  **Vereenvoudiging (bewust, zelfde als elders):** gebruikt de huidige
  `isActive`-status van elk item voor alle 12 maanden — er is geen
  historie van wanneer een item precies is geactiveerd/gedeactiveerd, dus
  een recent verwijderde vaste last verdwijnt met terugwerkende kracht uit
  de hele grafiek i.p.v. alleen vanaf het moment van verwijderen.
- Nieuw grafiekcomponent `MonthlyCashflowChart` (`components/cashflow/`) —
  gegroepeerde balken (sage inkomen, blauw `#7B92B2` uitgaven) + een
  neutrale netto-lijn waarvan alleen de stippen in tekort-maanden
  terracotta kleuren (designsysteem: terracotta blijft gereserveerd voor
  het negatieve geval, niet de lijn als geheel).
- Geplaatst op `/cashflow` tussen de "Vaste lasten & inkomsten"-KPI's en
  "Eenmalige uitgaven" (combineert beide, dus logisch ertussenin).

`tsc`/`eslint`/Vitest (219/219, +11 nieuwe tests) groen.

---

### [x] C10. Startpagina — Actief doel / FI-voortgang

**Status: gebouwd (Sprint 4 opgepakt).** Het "Actief doel"-blok op `/` was
een uitgeschakelde placeholder ("Beschikbaar in Sprint 4"); nu een echt
doel met voortgangsbalk (`--color-sage`, conform `frontend.md`).

**Scope (met de gebruiker afgestemd — meest complete optie):** drie
doeltypes, te kiezen bij het instellen:
- **Spaardoel** — voortgang t.o.v. je spaargeld (`savingsValue`, dezelfde
  bron als de bestaande buffer-dekking-KPI op deze pagina — dus ook
  dezelfde bekende beperking: telt alleen simple-entry-spaarrekeningen mee,
  niet spaargeld via het volle asset-systeem).
- **Vermogensdoel** — voortgang t.o.v. de al zichtbare "Netto vermogen"-KPI
  op dezelfde pagina (bewust dezelfde bron, geen tweede afwijkend
  vermogensgetal op één pagina — dat is incl. schulden, excl. vastgoed).
- **FI-dekkingsgraad** — hergebruikt de bestaande YTD-dekkingsgraad-
  berekening van Cashflow (`calculatePassiveIncomeCoverage`), doel is
  altijd 100%. Vult Deel B's beslissing in: "hoe dicht bij FI" hoort hier
  thuis, niet als startpagina-signaal.

**Bouw:**
- Nieuwe tabel `goals` (migratie `0024_tiresome_argent.sql` — **nog
  uitvoeren in Supabase, zie onder**) — bewust **maar 1 doel per tenant**
  (unique op `tenant_id`), geen geschiedenis/meerdere gelijktijdige doelen:
  sluit aan bij "Actief doel" (enkelvoud) en "geen afleidingen" uit
  `frontend.md`. `targetAmount` is null bij `passive_income_coverage` (dat
  doeltype streeft altijd naar 100%, geen apart bedrag nodig).
- Query-laag `goals.ts`: `getGoal`/`saveGoal` (upsert, geen aparte create/
  update-onderscheid nodig dankzij de 1-per-tenant-constraint)/`deleteGoal`.
  RLS-policies toegevoegd (tenant-scoped, zelfde patroon als
  `liabilities`/`recurring_items`).
- Pure functie `calculateGoalProgress` (`src/lib/finance/goal-progress.ts`,
  7 tests) — bedrag/dekkingsgraad tegen target als decimaal, mag boven 1
  uitkomen (doel gehaald, blijft gewoon doorgroeien). Geeft `null` terug
  bij ontbrekende data (nooit stilletjes 0/NaN), gooit een Error bij een
  ongeldig/ontbrekend doelbedrag.
- `ProgressBar` kreeg een `tone`-prop (`'neutral' | 'sage'`) — LTV blijft
  neutraal, het doel-blok toont `sage` conform `frontend.md`.
- Nieuw component `GoalCard` (`components/home/`): toont voortgang + inline
  bewerken/verwijderen (potlood/prullenbak, zelfde patroon als elders); geen
  doel ingesteld → direct het instelformulier i.p.v. een losse placeholder.
- Server actions in nieuw `src/app/actions.ts` (homepage had nog geen eigen
  actions-bestand): `saveGoalAction` (upsert, Zod-validatie incl. een
  refine die `targetAmount` alleen verplicht stelt buiten
  `passive_income_coverage`), `deleteGoalAction`.
- `/` haalt de YTD-passief-inkomen-data alleen op als het doel daadwerkelijk
  `passive_income_coverage` is (voorkomt een onnodige extra query voor de
  andere twee doeltypes).

`tsc`/`eslint`/Vitest (231/231, +12 nieuwe tests) groen.

**Vereist actie:** de migratie (`0024_tiresome_argent.sql`) plus de
`goals`-RLS-policies uit `rls.sql` moeten nog in de Supabase SQL Editor
uitgevoerd worden — zonder die tabel breekt de startpagina (`getGoal` zit
in het standaard Promise.all van `/`).

---

## Openstaande beslissingen — verzameld

Voor snel overzicht, dezelfde vragen als hierboven per punt:

- [x] C2: redirect `/assets/[id]` → `/portfolio/vastgoed/[id]` voor
      `real_estate` — gebouwd
- [x] C2: gedeeld component voor asset-posities over vijf pagina's —
      gebouwd (`AssetPositionsCard`)
- [x] C3: toggle vs. twee-naast-elkaar voor dubbele allocatieweergave —
      toggle gebouwd
- [x] C6: netto-inleg-KPI scope — alleen liquide, gebouwd
- [x] C7: UX-tekst voor wanneer simple-entry vs. vol asset te gebruiken —
      gebouwd
- [x] C8: risicobadge-labels vast per `assetType`, of per positie — vast
      per `assetType`, gebouwd
