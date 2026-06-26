# review-financieel-expert.md — Personal Finance App

Laatst bijgewerkt: 26 juni 2026
Doel: kritische review van de huidige codebase (Sprints 1.1 t/m 3.4) op
financiële correctheid, fiscale toepasbaarheid, gebruikswaarde voor de
particulier en data-integriteit.

Dit document is geschreven voor uitvoering in **Claude Code** binnen VS Code.
Elk panel is een aparte review-sessie. Output: bevindingen rapporteren —
geen fixes implementeren.

---

## 1. Hoe deze review uitgevoerd wordt

**Werkwijze per panel:**
1. Lees dit document én de relevante doc-bestanden (`finance-logic.md`,
   `data-model.md`, `frontend.md`).
2. Open de codebase in VS Code. Bestanden die per panel relevant zijn,
   staan onder elk panel benoemd.
3. Voer de checklist van dat panel sequentieel uit. Wees kritisch op
   conceptuele én implementatie-fouten. Vergelijk code tegen spec, niet
   alleen spec tegen logica.
4. Schrijf bevindingen weg in `docs/reviews/panel-<n>-<naam>.md` volgens
   het outputformaat onderaan dit document.
5. Bij twijfel: niet gokken, niet "fixen" — bevinding noteren met
   severity `?` en context, zodat de gebruiker beslist.
6. Voer vóór elke panel-start `vitest run` uit vanuit de projectroot en
   noteer failing tests als bevindingen met severity `🔴 kritiek` (locatie:
   het failing test-bestand). Bestaande testsuite is harde grond — een
   failing test hoeft niet geanalyseerd te worden; het ís de bevinding.

**Aanbevolen volgorde:** Panel 4 → Panel 1 → Panel 2 → Panel 3 → Panel 5.
Reden: data-integriteitsbevindingen (Panel 4) leggen de feitelijke staat
van de codebase bloot. Panel 1 (financieel) kan die als context gebruiken
bij beoordeling van berekeningen, en zo dubbele of conflicterende
bevindingen over decimal precision en FX voorkomen. Panel 2 en 3 bouwen
voort op Panel 1. Panel 5 (technisch) sluit af en kan bevindingen van
eerdere panels over testdekking en isolatie samenvatten.

**Wat de review NIET doet:**
- Geen code-aanpassingen tijdens de review.
- Geen voorgestelde implementaties van nieuwe features. Wel: aanwijzen
  dát iets ontbreekt, en wat het impactgebied is.
- Geen styling-/visuele review (komt in latere ronde).
- Geen security-review (komt in Fase 5).

**Severity-schaal (alle panels):**

| Severity | Betekenis |
|---|---|
| `🔴 kritiek` | Geeft foutieve financiële uitkomst aan de gebruiker. Niet vrijgeven naar productie. |
| `🟠 hoog` | Werkt wel, maar kan de gebruiker misleiden of belangrijke informatie wegmoffelen. |
| `🟡 medium` | Functioneel correct, maar mist nuance, edge case, of uitleg. |
| `🔵 laag` | Cosmetisch of stijlpunt; geen impact op uitkomst. |
| `?` | Onzeker — vraagt expliciete beslissing van de gebruiker. |

---

## 2. Vooraf bekende risico's (per panel uitwerken)

De volgende punten zijn al geïdentificeerd voorafgaand aan de review.
Elk panel moet ze in zijn eigen domein bevestigen, kwantificeren of
weerleggen — niet overslaan omdat ze hier al staan.

| # | Risico | Primair panel |
|---|---|---|
| R1 | URTH (USD) gebruikt als benchmark voor EUR-portfolio — valutarisico zit in outperformance. IWDA.AS (Euronext) is methodologisch juister. | Financieel |
| R2 | Vastgoed-XIRR mismatch: initiële cashflow is aankoopwaarde + kosten (volledig), sluitcashflow is equity (na hypotheek). Hypotheek ontbreekt aan één kant. | Financieel |
| R3 | "Rendement dit jaar" toont geannualiseerde XIRR over <12 maanden. Eerste kwartaal van +3% wordt zichtbaar als +12% YTD-XIRR — misleidend. | Financieel + Eindgebruiker |
| R4 | Kosten zijn vrijwel niet gemodelleerd: TER, broker-fees, valutaspread, dividendlek (15% US) ontbreken. Werkelijk rendement wordt overschat. | Financieel + Eindgebruiker |
| R5 | Geen forecast / verwacht rendement. Particulier kan zijn jaardoel niet zien. | Eindgebruiker |
| R6 | Geen tooltips of uitleg bij afkortingen (XIRR, TWR, LTV, cash-on-cash). | Eindgebruiker |
| R7 | Box 3 / box 1 onderscheid ontbreekt in rekenlaag. Eigen woning hoort in box 1, niet box 3. Hypotheekrenteaftrek en eigenwoningforfait worden niet berekend. | Fiscaal |
| R8 | Schema kent `tax_box`, maar wordt nergens gebruikt. Geen logica voor box 3-peildatum (1 januari) of forfaitaire/werkelijke rendementsheffing. | Fiscaal |
| R9 | `fx_rates` tabel bestaat maar wordt nergens gevuld of gebruikt. Bij non-EUR assets/koersen ontstaat onbekend gedrag. | Data-integriteit |
| R10 | Liquide/illiquide wordt door `calculateAllocation` berekend maar nergens getoond. | Eindgebruiker |

---

## 3. Panel 1 — Financieel expert / accountant

**Rol:** Onafhankelijk financieel professional die de wiskunde, definities
en methodologische keuzes valideert. Geen voorkennis van de codebase.
Werkt vanuit `finance-logic.md` als contract, vergelijkt met de
implementatie in `src/lib/finance/*`.

**Relevante bestanden:**
```
src/lib/finance/xirr.ts
src/lib/finance/twr.ts
src/lib/finance/cost-basis.ts
src/lib/finance/net-deposit.ts
src/lib/finance/current-value.ts
src/lib/finance/passive-income.ts
src/lib/finance/allocation.ts
src/lib/finance/real-estate.ts
src/lib/finance/net-worth.ts
src/lib/finance/benchmark.ts
src/lib/finance/net-worth-series.ts
src/lib/finance/finance.test.ts
src/lib/services/prices.ts
src/lib/services/benchmark.ts
src/lib/db/queries/assets.ts   (specifiek: getAssetWithCalculations)
src/lib/db/queries/cashflow.ts (specifiek: getNetWorthAtDate)
src/app/vermogen/page.tsx      (KPI's: rendement dit jaar, benchmark)
src/app/vastgoed/page.tsx      (vastgoed-rendementen, LTV)
```

**Checklist:**

1. **XIRR — convergentie en correctheid.** Bevestig dat `calculateXirr`
   exact de testcases A, B, C, D uit `finance-logic.md` § 6 reproduceert.
   Check ook: gedrag bij twee cashflows op dezelfde dag, bij zeer kleine
   bedragen (€0,01), bij periode korter dan 30 dagen (geannualiseerd
   rendement explodeert wiskundig — wordt dit afgevangen?).

2. **YTD-XIRR (R3).** Hoe wordt "Rendement dit jaar" berekend in
   `src/app/vermogen/page.tsx`? Geannualiseerde XIRR over een YTD-periode
   geeft op 28 februari een rendement *alsof het hele jaar zo doorgaat*.
   Voor een particuliere review-app is dat misleidend. Bevestig wat er
   nu staat en kwantificeer de afwijking met een testcase (bv. +3% over
   60 dagen → welke XIRR-waarde komt eruit?).

3. **TWR-correctie.** Sprint 3.2 vermeldt een bug-fix: "TWR voegde 1 toe
   aan een groeifactor die al ≥1 was". Reproduceer de testcases uit
   `finance-logic.md` § 7 én een derde testcase met opname (negatieve
   instroom) om de richting van het teken te valideren.

4. **Benchmark — URTH vs IWDA.AS (R1).** `src/lib/services/benchmark.ts`
   gebruikt URTH. Beoordeel:
   - Welke valuta noteert URTH? (USD)
   - Hoe wordt FX afgehandeld? (waarschijnlijk niet)
   - Is `getBenchmarkTwr` gebaseerd op USD-koersen die rechtstreeks met
     EUR-portfolio worden vergeleken? Zo ja → fout in outperformance.
   - Aanbeveling formuleren: IWDA.AS (EUR-genoteerd, MSCI World).

5. **TWR-subperioden voor benchmark.** `finance-logic.md` § 8 stelt:
   beide TWR's moeten over *exact dezelfde* subperioden lopen, met
   portfolio-cashflowdatums als snijpunten. Doet `getBenchmarkTwr` dit?
   Of pakt het simpelweg dagelijkse koersen onafhankelijk van het
   portfolio? Verschil heeft direct effect op excess return.

   Verplichte testcase: portfolio met één instroom op 15 maart.
   Portfolio-TWR loopt dan over twee subperioden: [1 jan – 15 mrt] en
   [15 mrt – peildatum]. Benchmark-TWR moet *dezelfde* snijpunten
   hanteren. Als benchmark over één aaneengesloten periode [1 jan –
   peildatum] loopt, zijn de twee TWR's methodologisch onvergelijkbaar —
   ook als de eindgetallen toevallig dicht bij elkaar liggen. Constateer
   expliciet welke van de twee situaties zich voordoet.

6. **Vastgoed-XIRR (R2).** Vergelijk de implementatie van
   `calculateRealEstateTotalReturn` met de testcase in
   `finance-logic.md` § 10e. Cashflows:
   - Initieel: `−(purchase_price + purchase_costs)` (volledig)
   - Sluit: `+(actuele_waarde − resterende_hypotheek)` (equity)

   Conceptueel discutabel: de hypotheek wordt aan de sluitcashflow
   *afgetrokken* maar zit nergens als positieve cashflow bij aankoop.
   Resultaat: het rendement op leverage wordt vermengd met het rendement
   op eigen inleg, op een manier die afwijkt van zowel cash-on-cash
   als unlevered IRR. Bepaal: is dit de bedoeling, of moet de aankoop-
   cashflow op `−(eigen_inleg)` worden gezet?

7. **Cost basis — AVCO.** Reproduceer testcase uit § 9. Check:
   - Wordt `fees` bij `buy` correct meegeteld in kostprijs?
   - Wordt `fees` bij `sell` *niet* meegeteld in kostprijs maar wel in
     XIRR-cashflow? (Anders dubbeltelling.)
   - Wat gebeurt er bij een `sell` die *alle* units afstoot? Heeft de
     volgende `buy` dan een schone kostprijs, of zit er nog een residu?

8. **Netto inleg vs. rendement.** § 12 definieert
   `rendement_component = totalAssets − cumulatieve_inleg`. Dit telt
   *alle* assets — inclusief vastgoed en pensioen, die hun eigen
   waardering hebben en geen transactie-instroom kennen. Bevestig dat
   `calculateNetDeposit` alleen op transactie-gedreven assets wordt
   toegepast, anders ontstaat een grote, foutieve "rendement"-bucket
   voor handmatig gewaardeerde assets.

9. **Decimal-discipline.** Steekproefsgewijs in `lib/finance/*`:
   wordt `decimal.js` consistent gebruikt, of glipt er ergens een
   native `number / number` doorheen in tussenberekeningen? Met name:
   - XIRR Newton-Raphson loop
   - Percentage-berekeningen in allocatie
   - LTV-deling

10. **Kosten-impact op rendement (R4).** Constateer expliciet dat
    `calculateXirr` *alleen* transactie-fees ziet, niet TER van fondsen,
    valutaspread, of bronbelasting op dividend. Voor "werkelijk
    rendement" is dit een gat. Aanbeveling formuleren over modellering
    (bv. periodiek TER-percentage per asset; expliciete `cost`-
    transactie met categorie).

11. **Eenheid van outperformance.** § 8 vermeldt: "0,03 = 3 procentpunten
    — niet 3%". Wordt dit in de UI ook zo getoond, of staat er gewoon
    "3%"? (`src/app/vermogen/page.tsx` KPI-card "vs Benchmark".)

**Outputlocatie:** `docs/reviews/panel-1-financieel.md`

---

## 4. Panel 2 — Fiscaal expert (Nederlandse situatie)

**Rol:** Nederlandse belastingadviseur die beoordeelt of de app de
fiscale werkelijkheid correct kan modelleren en of de berekeningen
voor "rendement na belasting" haalbaar zijn binnen het huidige datamodel.

**Context vooraf:**
- App-context is Nederland (zie `context.md`).
- Box 3 mechanics: peildatum 1 januari, drie categorieën (bank-
  tegoeden, overige bezittingen, schulden), elk eigen forfaitair
  rendement, schuldendrempel, heffingsvrij vermogen.
- Box 1: eigen woning (eigenwoningforfait, hypotheekrenteaftrek),
  pensioenopbouw (vrijgesteld in opbouwfase, belast bij uitkering).
- Box 2: aanmerkelijk belang — buiten scope.
- "Werkelijk rendement" via Wet rechtsherstel / overbruggingswet —
  per categorie, niet per individueel asset.

**Relevante bestanden:**
```
data-model.md                              (sectie asset_tax_metadata + transactions)
src/lib/db/schema.ts                       (kolommen: tax_box, tax_year, is_tax_relevant)
src/lib/db/seed.ts                         (welke tax_box wordt nu toegekend?)
src/app/vermogen/page.tsx                  (geen post-tax KPI?)
src/app/vastgoed/page.tsx                  (eigen woning vs verhuur — fiscaal verschillend)
src/app/cashflow/page.tsx                  (passief inkomen — pre-tax of post-tax?)
src/lib/finance/passive-income.ts          (hoe wordt huur belast meegenomen?)
```

**Checklist:**

1. **Box-toewijzing per asset-type (R7).** Bevestig of het datamodel
   correct kan uitdrukken:
   - Aandelen/ETF/crypto in regulier bezit → box 3, categorie "overige
     bezittingen"
   - Spaarrekening → box 3, categorie "banktegoeden" (ander forfaitair
     rendement)
   - Verhuurpand → box 3, "overige bezittingen" — tenzij sprake is van
     meer dan normaal vermogensbeheer (dan box 1)
   - Eigen woning → box 1, met eigenwoningforfait
   - Pensioen (opbouwfase) → box 1, vrijgesteld in box 3
   - Hypotheek eigen woning → box 1 (rente aftrekbaar)
   - Hypotheek verhuurpand → box 3 (schuld)

   Constateer wat het schema mist of niet expliciet maakt.

2. **Box 3-peildatum (R8).** De heffing is gebaseerd op 1 januari.
   Voor stocks/ETFs is 1 januari geen beursdag (1 jan = feestdag). Welke
   datum wordt gehanteerd voor waardering — is dit nu nergens, of zit er
   ergens een impliciete keuze? (Tip: laatste handelsdag december is de
   geaccepteerde praktijk.) Crypto: 24/7 markt, 1 januari werkt.

3. **Drie categorieën box 3.** De huidige `tax_box` is één veld (`box1`,
   `box2`, `box3`). Voor correcte heffingsberekening moet er binnen box 3
   onderscheid zijn tussen `banktegoeden`, `overige_bezittingen`,
   `schulden` (elk eigen forfait). Beoordeel: moet hier een sub-kolom
   bij, of kan dit afgeleid worden uit `asset.type`?

4. **Heffingsvrij vermogen + fiscaal partnerschap.** Heffingsvrije voet
   verdubbelt voor fiscaal partners. Het datamodel kent nu geen
   `tax_profile` of `is_fiscal_partner`. Wat is nodig om dit te
   modelleren zonder het schema breed te slopen?

5. **Eigen woning (box 1).** Modellering vereist:
   - WOZ-waarde (zit al via `asset_valuations`)
   - Eigenwoningforfait-percentage (jaarlijks parameter, schijven)
   - Hypotheekrente betaald in jaar X (komt nu nergens uit — `mortgages`
     heeft alleen `interest_rate` en `original_amount`, geen
     betaalde-rente-historie)
   - Aftrek-tarief (afgetopt op laagste schijf — beweegt jaarlijks)

   Constateer welke datapunten ontbreken.

6. **Verhuurpand-belasting.** Verhuurpand in box 3 betekent: heffing
   over WOZ-waarde minus hypotheek (= equity), tegen forfaitair
   rendement "overige bezittingen". De *werkelijke* huurinkomsten zijn
   in box 3 niet belast — alleen het forfait. Dit is een belangrijk
   gegeven voor de "rendement na belasting"-vraag bij verhuur:
   netto-huurrendement is *al* netto van box 3 (als je het forfait
   afzonderlijk berekent). Niet dubbeltellen.

7. **Werkelijk rendement na belasting.** Voor de KPI "netto rendement
   na belasting" zijn twee benaderingen mogelijk:
   - **a. Pre-tax XIRR − geschatte box 3-heffing over peildatumwaarde.**
     Eenvoudig, maar mengt een rendementsmaatstaf met een
     vermogensheffing — wiskundig wankel.
   - **b. Aparte sectie "Belastingdruk op vermogen"** die de jaarlijkse
     heffing toont in euro's én als percentage van het vermogen, los van
     het rendementsgetal.

   Beoordeel welke benadering eerlijker is voor een particulier en
   beargumenteer.

8. **Wet rechtsherstel / Overbruggingswet / werkelijk rendement.**
   Relevante wettelijke tijdlijn:
   - **Wet rechtsherstel box 3** → betrekking op 2017–2022 (n.a.v. Hoge
     Raad-uitspraak december 2021).
   - **Overbruggingswet box 3** → van toepassing op belastingjaren
     2023 en 2024. Drie categorieën met elk eigen forfaitair rendement
     (banktegoeden ca. 1,03%, overige bezittingen ca. 6,04%, schulden
     ca. 2,47% — percentages bewegen jaarlijks bij AMvB).
   - **Nieuw stelsel werkelijk rendement** → beoogd per 2027 (op moment
     van schrijven nog niet in werking getreden).

   Voor belastingjaar 2025 geldt een verlengingsvorm van de
   Overbruggingswet; controleer op de exacte invoerdatum van het nieuwe
   stelsel voordat modelleerkeuzes worden vastgelegd.

   De tegenbewijsregeling laat belastingplichtigen het werkelijke
   rendement aangeven als dat lager is dan het forfait. Dit vereist
   *per categorie* een rendementsberekening (vermogensaanwas inclusief
   ongerealiseerd). Het datamodel ondersteunt dit deels (transacties
   + waarderingen), maar:
   - Wordt waardestijging per kalenderjaar correct geïsoleerd?
   - Hoe wordt 1-jan-waarde bepaald voor crypto (transactiehistorie wel
     beschikbaar) vs voor spaargeld (alleen valuations)?
   - Welke wettelijke grondslag ondersteunt de app — Overbruggingswet
     of het toekomstige nieuw stelsel? Deze keuze bepaalt de
     modelleervereisten en moet expliciet in de projectdocumentatie
     worden vastgelegd.

9. **Pensioen-rendement.** Pensioen is in opbouwfase niet belast (box 1
   vrijstelling box 3). Maar in de app wordt het wel meegerekend in
   netto vermogen — dat is voor *eigen overzicht* terecht, maar mag *niet*
   meedoen in de box 3-berekening. Is die scheiding mogelijk in de
   huidige rekenlaag, of wordt nu alles op één hoop gegooid?

10. **Toekomst-ankering.** `fiscal-layer.md` is reeds in voorbereiding
    (volgens projectcontext). Beoordeel of het huidige schema voldoende
    open is om die laag toe te voegen zonder migrations te breken.
    Specifiek: `tax_parameters` tabel (jaarschijven, percentages,
    drempels) ontbreekt nog volledig.

**Outputlocatie:** `docs/reviews/panel-2-fiscaal.md`

---

## 5. Panel 3 — Eindgebruiker (particulier, "Jan en alleman")

**Rol:** Particulier met gemiddelde financiële kennis. Heeft een
spaarrekening, één ETF bij DEGIRO, misschien wat crypto, een koophuis
met hypotheek, en pensioen via de werkgever. Begrijpt "rendement" maar
niet "XIRR". Wil maandelijks even kijken hoe het ervoor staat — niet
studeren.

**Centrale vraag:**
*Bij elke pagina en KPI: snapt deze gebruiker wat hij ziet, en helpt het
hem antwoord te geven op de drie north-star-vragen?*

**Relevante bestanden:**
```
src/app/page.tsx              (Overzicht)
src/app/vermogen/page.tsx     (Vermogen)
src/app/vastgoed/page.tsx     (Vastgoed)
src/app/cashflow/page.tsx     (Cashflow)
src/components/ui/KpiCard.tsx
src/components/ui/ProgressBar.tsx
src/components/vermogen/*
src/components/cashflow/*
frontend.md                   (designintentie)
```

**Checklist:**

1. **Tooltips en uitleg (R6).** Doorloop alle KPI's. Voor elke afkorting
   of jargon-term: staat er een uitleg? Tooltip-on-hover? Voetnoot?
   In de huidige codebase ontbreekt een Tooltip-pattern. Lijst op:
   - XIRR (nergens uitgelegd)
   - TWR (komt in UI niet voor — goed)
   - LTV
   - Cash-on-cash
   - Netto huurrendement vs. totaalrendement
   - "Inleg" vs "rendement-component"
   - "Excess return" / "vs Benchmark"

   Welke termen moeten weg uit de UI (te complex voor doelgroep) en
   welke moeten blijven mét uitleg?

2. **YTD-XIRR misleiding (R3).** Op de Vermogen-pagina staat
   "Rendement dit jaar". Voor een particulier die in maart kijkt: ziet
   hij +12% terwijl het feitelijk +3% YTD is, en wat denkt hij dan?
   Beoordeel de UX-impact en formuleer alternatief (bv. "absolute
   verandering YTD" en "geannualiseerd rendement (sinds start)").

3. **Ontbrekende KPI: liquide vermogen (R10).** `calculateAllocation`
   produceert al een liquid/illiquid splitsing, maar het wordt nergens
   getoond. Voor een particulier is de vraag "hoeveel kan ik morgen
   pakken zonder iets te verkopen" extreem relevant. Constateer
   ontbreken.

4. **Ontbrekende KPI: inleg vs. rendement-splitsing.** § 12 van
   `finance-logic.md` beschrijft de splitsing, maar wordt nergens
   getoond. Voor een particulier is "hoeveel heb ik zelf ingebracht
   vs wat heeft mijn geld opgeleverd" een sterk inzicht.

5. **Ontbrekende KPI: verwacht rendement / koers op jaardoel (R5).**
   Particulier wil weten: "ga ik mijn jaarrendement halen?". Mogelijke
   invullingen:
   - Pace-indicator: huidige YTD-rendement geëxtrapoleerd vs.
     historisch gemiddelde.
   - Eindejaarsprognose met bandbreedte op basis van benchmark-volatiliteit.
   - Eenvoudige "op koers / achter / voor"-melding zonder getal.

   Aanbeveling formuleren over welke vorm past bij "Jan en alleman".

6. **Ontbrekende KPI: kosten-overzicht (R4).** "Wat kost het me dit
   jaar?" — broker-fees, TER, valutakosten, belasting. Voor de
   particulier is dit één van de meest motiverende inzichten (kosten
   zijn beïnvloedbaar; rendement niet). Constateer wat er ontbreekt en
   waar dit op welke pagina zou kunnen landen.

7. **Cashflow-pagina compleetheid.** Toont nu passief inkomen YTD en
   netto-vermogensgroei YTD. Mist: cumulatieve cashflow door het jaar
   (grafiek), maand-op-maand patroon, vergelijking met vorig jaar.
   Beoordeel of dit past bij de doelgroep of overkill is.

8. **Vastgoed-pagina compleetheid.** Toont per pand: KPI's, LTV, cashflow
   verhuur. Mist mogelijk:
   - Aflossingsverloop hypotheek (grafiek)
   - Maandlasten netto (hypotheek + kosten − huur) — direct relevant
     voor cashflow-planning
   - WOZ-historie en groei
   - Voor eigen woning: bruto vs netto woonlasten

9. **Homepage Blok 1 "hero".** `frontend.md` beschrijft "Nog ongeveer 8
   jaar [tot financiële vrijheid]". Is die berekening geïmplementeerd
   of hardcoded? Zo ja, op basis waarvan? Voor "Jan en alleman" is dit
   een geladen claim die kwantitatief verdedigbaar moet zijn — of
   weghalen.

10. **Lege staten en eerste-gebruik.** Wat ziet de gebruiker bij 0
    assets? Bij 1 asset? Bij assets zonder valuations? Doorloop concreet
    en noteer welke pagina's nu een verwarrende lege of foutieve staat
    tonen.

11. **Eenheden en notatie.** Steekproef:
    - Worden percentages consistent met "%" getoond?
    - Wordt "0,03 = 3 procentpunten" verschil correct gecommuniceerd, of
      staat er "3%" voor outperformance (verwarrend)?
    - Worden grote bedragen leesbaar gegroepeerd (€1.234.567)?
    - Worden negatieve bedragen op de juiste manier getoond
      (terracotta-kleur volgens `frontend.md`, niet rood)?

**Outputlocatie:** `docs/reviews/panel-3-eindgebruiker.md`

---

## 6. Panel 4 — Data-integriteit

**Rol:** Ingenieur die test of de app robuust is tegen ontbrekende,
inconsistente of vreemde data — niet tegen tegenstanders (security),
maar tegen de werkelijkheid (ETF-prijs is even niet beschikbaar, gebruiker
typt iets vreemds, een valuation ontbreekt).

**Relevante bestanden:**
```
src/lib/services/prices.ts          (Yahoo Finance integratie)
src/lib/services/benchmark.ts
src/lib/db/queries/assets.ts
src/lib/db/queries/cashflow.ts
src/lib/db/queries/transactions.ts
src/app/assets/actions.ts           (Zod-validatie)
src/components/assets/AssetForm.tsx
src/components/assets/TransactionForm.tsx
src/lib/db/schema.ts                (constraints, defaults)
```

**Checklist:**

1. **Prijsuitval.** Yahoo Finance API niet bereikbaar of geeft `null`.
   Wat gebeurt er in:
   - `getAssetWithCalculations` (fallback naar laatste valuation —
     bevestigen)
   - `getAssetsWithValues` (parallel fetch — gedraagt zich consistent?)
   - `getBenchmarkTwr` (Sprint 3.4 zegt `.catch(() => null)` — bevestig
     dat de pagina dan niet breekt en KPI "—" toont)

   Wordt de gebruiker geïnformeerd dat de getoonde waarde stale is, of
   wordt stille terugval gepleegd?

2. **Assets zonder transacties (stock_etf, crypto).** Wat is het gedrag
   van `calculateCostBasis`, `calculateXirr`, `calculateMarketValue`?
   - Lege array → throw of stille 0?
   - XIRR met <2 cashflows → expected Error per spec § 6, maar wordt
     die error in de UI netjes opgevangen?

3. **Asset met `is_active = false`.** Soft delete-conventie. Worden deze
   correct uitgesloten in:
   - `getAssets`, `getAssetsWithValues`
   - `getLiquidAssetsWithCalculations`
   - `buildNetWorthSeries` (historisch — een asset die later inactief
     werd hoorde wel in de historie op moment T)
   - Allocatie- en passief-inkomen-berekeningen

4. **Negatieve waarden waar dat niet mag.** Schema heeft
   `CHECK (amount >= 0)` op transactions. Maar:
   - Kan een valuation negatief zijn (foutieve invoer)? Wat doet de
     berekening?
   - Kan `outstanding_balance` op hypotheek negatief worden bij
     teveel-aflossing? Wat gebeurt er met LTV-berekening?

5. **Datums in de toekomst.** Wat als een transactie een toekomstige
   datum heeft? XIRR moet dat aankunnen (cashflows kunnen na peildatum
   liggen), maar voor "YTD" of "tot peildatum" is dat verwarrend.
   Wordt dit afgevangen op invoer?

6. **Tijdzones.** `created_at` is `timestamptz` (UTC), `date` op
   transactions is `date` (timezone-loos). Bij berekeningen met
   peildatum "vandaag": welke tijdzone wordt gebruikt? Een transactie
   van 23:30 UTC op 31 december — valt die in 2025 of 2026 in de
   YTD-berekening? Steekproef in:
   - `calculatePassiveIncome` (datum-filter)
   - `getNetWorthAtDate`
   - "Rendement dit jaar" YTD-berekening

7. **FX / `fx_rates` (R9).** Tabel bestaat in het schema maar:
   - Wordt deze ergens gevuld? (Zoek naar `INSERT INTO fx_rates` of
     vergelijkbaar.)
   - Wordt deze ergens *gebruikt*? (Zoek naar `fx_rates` of `fxRates`
     in queries en finance-laag.)
   - Wat gebeurt er met een BTC-koers die in USD binnenkomt? Wordt die
     omgerekend naar EUR voor `currentValue`? Of staat het bedrag al in
     EUR?

8. **Multi-currency op transactions.** `transactions.currency` heeft
   default `'EUR'`. Wat als een transactie in USD wordt ingevoerd?
   - Wordt FX-rate op transactiedatum opgezocht?
   - Wat doet XIRR — staan cashflows daar in EUR of origin currency?

9. **Decimal precision in opslag vs berekening.** `numeric(15,2)` voor
   geldbedragen, `numeric(18,8)` voor units. Bij retournering naar de
   applicatie: zijn dit strings (uit `postgres`-driver) of numbers?
   Worden ze correct in `decimal.js` ingelezen voordat ze gebruikt
   worden, of glipt er ergens parsing-verlies in?

10. **Zod-validatie aan de rand.** `src/app/assets/actions.ts` gebruikt
    Zod. Steekproef:
    - Wordt `amount` als string of number gevalideerd?
    - Worden negatieve waarden afgewezen waar nodig?
    - Wat gebeurt er met onverwacht extra velden in form data?
    - Hoe wordt een `numeric` met meer decimalen dan toegestaan
      afgehandeld?

11. **Tenant-isolatie in queries.** RLS staat aan in de database, maar
    elke query filtert ook expliciet op `userId` via `tenant_users`.
    Dit is een gordel-én-bretels-aanpak. Bevestig steekproefsgewijs dat
    geen enkele query alleen op RLS leunt — als RLS-policy ooit een gat
    heeft, moet de applicatielaag het opvangen.

**Outputlocatie:** `docs/reviews/panel-4-data-integriteit.md`

---

## 7. Panel 5 — Technische architectuur

**Rol:** Software engineer die de codebase beoordeelt op structuur,
onderhoudbaarheid, testdekking en performance. Geen financiële of fiscale
kennis vereist. Werkt vanuit `CLAUDE.md` en de beschreven mappenstructuur
als contract.

**Relevante bestanden:**
```
src/lib/finance/finance.test.ts
src/lib/finance/*.ts              (structuur en testbaarheid)
src/lib/db/queries/              (query-patronen)
src/lib/db/schema.ts
src/app/**/page.tsx               (Server vs. Client Component-grens)
src/app/**/actions.ts             (Server Actions)
src/components/**/*.tsx           ("use client"-gebruik)
CLAUDE.md                         (architectuurregels als contract)
```

**Checklist:**

1. **Testsuite — falen en dekking.** Voer `vitest run` uit. Zijn er
   failing tests? Zo ja: elk failing test is een `🔴 kritiek` bevinding
   (locatie: het failing test-bestand). Voer daarna `vitest run --coverage`
   uit en rapporteer:
   - Statement coverage van `src/lib/finance/*` (streefwaarde: >80%).
   - Welke functies hebben 0% dekking?
   - Welke edge cases uit de checklists van Panel 1 ontbreken als
     testcase (bv. XIRR op <30 dagen, TWR met onttrekking)?

2. **Server vs. Client Component-grens (CLAUDE.md § 1).** Steekproef
   over `src/app/` en `src/components/`:
   - Staat `"use client"` uitsluitend op componenten die charts,
     formulieren, filters of browser-API's bevatten?
   - Zijn er Server Components die data ophalen via `useEffect`?
   - Zijn er Client Components die Drizzle- of Supabase-queries bevatten?

3. **Data-access grens (CLAUDE.md § 2).** Controleer of alle
   Drizzle-queries in `src/lib/db/queries/` staan:
   - Is er inline Drizzle-code in pagina-componenten of Server Actions
     buiten de queries-map?
   - Worden Supabase-clients ergens gebruikt voor database-queries in
     plaats van uitsluitend voor auth?

4. **N+1 queries.** Doorloop de query-functies in `src/lib/db/queries/`.
   Wordt per asset, per transactie of per pand een aparte query uitgevoerd
   in een loop? Specificeer locatie en verwacht aantal queries bij 10 assets.

5. **TypeScript strict-mode compliance.** Zijn er `any`-typen zonder
   begeleidend comment? Zijn er type-assertions (`as SomeType`) die een
   runtime-probleem maskeren? Steekproef in:
   - `src/lib/finance/*.ts`
   - `src/lib/db/queries/*.ts`
   - `src/app/**/actions.ts`

6. **Finance-laag isolatie (CLAUDE.md § 3).** `src/lib/finance/` moet
   puur TypeScript zijn — geen React, Drizzle, Supabase. Bevestig dat
   er geen framework-imports zijn in de finance-bestanden.

7. **Server Actions en mutaties.** CLAUDE.md schrijft voor: mutaties via
   Server Actions, geen losse API-routes. Controleer:
   - Zijn er `/api/`-routes die mutaties uitvoeren?
   - Worden Server Actions correct gevalideerd met Zod aan de rand?
   - Worden fouten in Server Actions teruggegeven op een manier die de
     UI kan tonen (geen onafgevangen throws die een 500 veroorzaken)?

8. **Dode code en ongebruikte exports.** Zijn er functies, types of
   constanten in `lib/finance/` of `lib/db/queries/` die nergens worden
   geïmporteerd? (Bv. `calculateAllocation` — Panel 3 R10 stelt dat de
   uitkomst nergens getoond wordt; wordt de functie dan überhaupt
   aangeroepen?)

9. **Circular dependencies.** Zijn er circulaire imports tussen modules —
   in het bijzonder tussen `lib/finance/`, `lib/db/` en `components/`?
   Circular deps zijn moeilijk te debuggen en blokkeren tree-shaking.

10. **Bundle-impact van `"use client"`.** Zijn er grote bibliotheken
    (bv. `decimal.js`, `recharts`) die onnodig in Client Components worden
    geïmporteerd, terwijl de berekening of data-transformatie op de server
    kan plaatsvinden?

**Outputlocatie:** `docs/reviews/panel-5-technisch.md`

---

## 8. Outputformaat — hoe te rapporteren

Elk panel-document volgt deze structuur:

```markdown
# Panel <n> — <naam>

Reviewdatum: <YYYY-MM-DD>
Reviewer: Claude Code
Codebase commit: <git rev-parse HEAD>

## Samenvatting

Drie tot vijf zinnen. Wat is de algemene staat van dit domein? Welke
twee of drie bevindingen verdienen de meeste aandacht?

## Bevindingen

### F-<n>.1 — <korte titel> [🔴/🟠/🟡/🔵/?]

**Locatie:** `pad/naar/bestand.ts:regel` of conceptueel.
**Bevinding:** Wat is er aan de hand?
**Onderbouwing:** Waarom is dit een issue? Verwijs naar spec, testcase,
of redenering. Voor financiële bevindingen: getal-voorbeeld erbij.
**Impact:** Welke gebruiker, welke pagina, welke uitkomst wordt geraakt?
**Open vraag (optioneel):** Wat moet de gebruiker beslissen?

### F-<n>.2 — ...
```

**Regels voor bevindingen:**
- Eén bevinding = één onderwerp. Geen "verzamel-bevindingen".
- Severity is verplicht.
- Bij `🔴 kritiek`: locatie en reproductiestappen verplicht.
- Bij `?`: open vraag verplicht — wat is er nodig om severity te
  bepalen?
- Geen voorgestelde fixes inline. Wel: alternatieven benoemen als open
  vraag.

**Na alle vijf panels:**
Schrijf `docs/reviews/synthese.md` met:
- Top-5 bevindingen overall (severity × impact).
- Per bevinding: impactschatting — op hoeveel pagina's / gebruikersstromen
  is dit zichtbaar? Gebruik drie categorieën: `elke sessie` (gebruiker
  stuit er elke keer op), `frequent` (bij normaal gebruik regelmatig
  zichtbaar), `edge case` (specifieke situatie of invoercombinatie).
- Conflicten tussen panels (komt voor — bv. fiscaal expert wil meer
  detail, eindgebruiker wil minder complexiteit).
- Aanbeveling over prioritering: welke bevindingen blokkeren een
  volgende sprint, welke kunnen wachten.

---

## 9. Wat de review NIET levert

- Geen code-aanpassingen.
- Geen nieuwe sprintdefinitie. (Volgt apart, na bespreking van
  bevindingen.)
- Geen oordeel over de *visuele* afwerking. Tooltips zijn wel scope
  (UX/uitleg), kleuren en spacing niet.
- Geen oordeel over testdekking van non-finance-code. Testdekking van
  `src/lib/finance/` is wel scope — zie Panel 5, item 1.

---

## 10. Tot slot voor de reviewer

Wees expliciet over onzekerheid. Een goed `?` met heldere open vraag
is waardevoller dan een nepzeker `🟠`. De gebruiker beslist; jij wijst
aan.

Vergelijk altijd implementatie tegen `finance-logic.md` als contract.
Als de implementatie van het contract afwijkt: dat is een bevinding,
ook als de implementatie "logischer" lijkt. Het contract is leidend
tot expliciet gewijzigd in een sprint.
