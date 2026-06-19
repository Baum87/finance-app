# financial-expert.md — Financieel reviewkader

Laatst bijgewerkt: 15 juni 2026
Status: actief — raadplegen bij elke sprint die raakt aan berekeningen, UI of nieuwe features

Dit document is het **financiële geweten van het project**. Het stelt de vragen die een
onafhankelijk financieel adviseur zou stellen bij elk onderdeel van de app. Het geeft geen
code — het geeft kaders, waarschuwingen en vragen die beantwoord moeten zijn voordat iets
gebouwd of getoond wordt.

Gebruik dit document:
- Aan het begin van elke sprint: loopt de scope langs de relevante secties
- Bij UI-beslissingen: is wat we tonen wat de gebruiker begrijpt en mag begrijpen?
- Bij berekeningen: klopt de definitie, en is de context helder voor de gebruiker?

---

## 1. Fundamentele onderscheidingen

Deze onderscheidingen moeten overal consistent zijn — in berekeningen, in UI-labels en
in de documentatie. Verwarring hier leidt tot verkeerde beslissingen van de gebruiker.

### 1a. Bruto vs. netto

| Term | Betekenis | Waar relevant |
|---|---|---|
| **Bruto vermogen** | Som van alle assets vóór aftrek van schulden | Allocatiegrafiek, totaal-asset-overzicht |
| **Netto vermogen** | Bruto vermogen minus alle schulden (hypotheken + overige) | Hoofdmetric, homepage KPI, vermogensontwikkeling |
| **Bruto huurrendement** | Jaarhuur / aankoopwaarde, vóór kosten | Vastgoedpagina — altijd naast netto tonen |
| **Netto huurrendement** | (Jaarhuur − kosten) / aankoopwaarde | Vastgoedpagina — de eerlijkere metric |

**Regel:** toon nooit een rendement als "rendement" zonder te specificeren of het bruto of
netto is. De gebruiker zal altijd het hogere getal onthouden.

### 1b. Rendement vs. cashflow

Rendement en cashflow zijn niet hetzelfde en mogen nooit worden verward:

- **Rendement** = procentuele maatstaf van waardecreatie over tijd (XIRR, TWR)
- **Cashflow** = wat er daadwerkelijk op de bankrekening verschijnt

Voorbeeld: een verhuurappartement met 8% XIRR kan negatieve maandelijkse cashflow hebben
als de hypotheeklasten hoger zijn dan de huurinkomsten. De app toont nu passief inkomen
(huur minus kosten) maar trekt hypotheekrente en -aflossing niet af. Dat is financieel
correct voor rendementsdoeleinden, maar moet voor de gebruiker expliciet worden benoemd.

**Actie:** op de cashflowpagina een heldere toelichting dat hypotheeklasten hier
buiten beschouwing blijven, en waarom.

### 1c. Beleggingsportefeuille vs. totaalvermogen

Dit is de meest onderschatte verwarring in de app:

- **Totaalvermogen (netto):** alles inclusief eigen woning, vastgoed, pensioen
- **Beleggingsportefeuille:** alleen de liquide, actief gestuurde assets (stock_etf, crypto, savings)

Wanneer vastgoed 90%+ van het totaalvermogen uitmaakt, zegt een allocatiegrafiek van het
totaalvermogen vrijwel niets over beleggingskeuzes. De grafiek laat dan zien: "93% vastgoed"
— maar dat is geen beslissing, dat is een feit over eigenwoningbezit.

**Aanbeveling:** toon op de vermogenspagina TWÉ inzichten:
1. Totale vermogensallocatie (inclusief vastgoed en pensioen) — voor de balans-vraag
2. Beleggingsportefeuille-allocatie (alleen liquide assets) — voor de "wat doe ik actief" vraag

---

## 2. Rendementsberekeningen — wat klopt, wat misleidt

### 2a. XIRR — sterktes en beperkingen

XIRR is de juiste keuze als primaire rendementsmaatstaf per asset. De implementatie is
correct. Maar er zijn contextuele beperkingen die de gebruiker moet begrijpen:

**Waar XIRR sterk is:**
- Rendeert de werkelijke opbrengst van jouw specifieke aan- en verkooptijdstip
- Vergelijkbaar met wat een bankier "internal rate of return" noemt
- Correct voor: één ETF, één cryptopositie, één vastgoedobject

**Waar XIRR minder geschikt is:**
- **Totaalportfolio XIRR over gemengde assets:** XIRR over aandelen + vastgoed + spaargeld
  in één getal maskeert de fundamenteel andere risicoprofielen. Een XIRR van 7% kan komen
  van 12% op ETFs en 3% op spaargeld — of andersom. Toon het altijd per categorie naast
  het totaal.
- **Korte periodes (< 1 jaar):** XIRR annualiseert. Een goede maand ziet er uit als 200%
  op jaarbasis. Dit is rekenkundig correct maar gedragsmatig gevaarlijk.
- **Vergelijking met benchmark:** XIRR vergelijken met TWR van een index is appels vs. peren
  (zie sectie 2c). De app doet dit nu in de benchmark-KPI — dit vereist een waarschuwingslabel.

**Actie:** bij XIRR altijd de periode tonen waarover het berekend is. Nooit als los getal.

### 2b. TWR — alleen voor benchmark, niet als zelfstandig getal

De beslissing om TWR uitsluitend voor benchmarkvergelijking te gebruiken is correct.
TWR vertelt "hoe goed was de fondskeuze" — maar dat is alleen zinvol in vergelijking.

TWR als zelfstandig getal aan de gebruiker tonen is verwarrend en onnodig.

### 2c. De benchmark-vergelijking: het grootste risico in de app

De huidige implementatie vergelijkt **portfolio XIRR** met **URTH TWR**. Dit zijn twee
verschillende grootheden:

| Grootheid | Meet | Beïnvloed door timing? |
|---|---|---|
| XIRR portfolio | Jouw persoonlijk rendement incl. stortingstijdstip | Ja — sterk |
| TWR benchmark (URTH) | Fondsprestatie ongeacht timing | Nee — bewust |

Als je in januari €10.000 inlegt net voor een dip, en de markt herstelt in december,
ziet jouw XIRR er slecht uit terwijl de URTH TWR goed is — niet omdat jij slechter
presteerde, maar omdat jij op het verkeerde moment instapte.

**Gevolg:** de "+1,2% vs benchmark" KPI kan zowel té positief als té negatief zijn,
afhankelijk van stortingstiming.

**Aanbeveling:**
- Toon de vergelijking wel — het is informatief
- Voeg een permanente disclaimer toe: "Dit vergelijkt jouw persoonlijk rendement (XIRR)
  met de marktprestatie (TWR). Timing van stortingen beïnvloedt dit getal sterk."
- Overweeg voor v2: portfolio TWR berekenen over dezelfde sub-periodes als URTH,
  zodat je appels met appels vergelijkt

### 2d. Vastgoedrendement — de hefboom-illusie

Cash-on-cash rendement van 14,91% ziet er indrukwekkend uit. Maar dit getal is hoog
omdat de hypotheek als hefboom werkt. Als de woningwaarde daalt, werkt de hefboom
andersom — dan verlies je ook meer dan je ingelegd hebt.

**Risico:** de gebruiker ziet "14,91% cash-on-cash" en denkt dat zijn vastgoed
beter presteert dan zijn ETF-portefeuille. Maar cash-on-cash en XIRR zijn niet
direct vergelijkbaar als risicogecorrigeerde maatstaven.

**Aanbeveling:**
- Altijd cash-on-cash tonen naast netto huurrendement op aankoopwaarde
- Toevoegen: actuele LTV als risico-indicator — laat zien hoeveel hefboom er nog is
- In de toelichting: "Cash-on-cash is hoog door de hypotheekfinanciering. Dit
  vergroot zowel winst als verlies bij waardeveranderingen."

---

## 3. Wat de gebruiker ziet vs. wat het betekent

### 3a. Netto vermogen op de homepage — wat telt mee?

De huidige berekening:
```
netto_vermogen = alle assets (inclusief eigen woning) − alle schulden
```

Dit is de boekhoudkundige definitie en die is correct. Maar voor een gebruiker die
"op koers naar financiële vrijheid" wil beoordelen, is de eigen woning misleidend:
je kunt er niet van leven tenzij je verkoopt of de overwaarde opneemt.

**Lagen die je zou kunnen tonen:**
1. Netto vermogen totaal (huidige implementatie) — boekhoudkundig correct
2. Vrij beschikbaar vermogen = liquide assets − overige schulden (zonder woning/pensioen)
3. Financiële onafhankelijkheidsratio = passief inkomen / maandelijkse uitgaven (Fase 4)

De app toont nu alleen laag 1. Dat is een beginpunt, maar de "op koers naar financiële
vrijheid"-boodschap op de homepage is prematuur zonder laag 2 of 3.

**Actie voor v1:** voeg onder het netto vermogen-getal een ondertitel toe:
"Inclusief eigen woning (€X) en pensioen (€Y)" — zodat de gebruiker begrijpt
wat er in het getal zit.

### 3b. Passief inkomen — wat de gebruiker verwacht vs. wat er staat

De cashflowpagina toont passief inkomen als:
```
dividend + rente + huurinkomsten − vastgoedkosten
```

Wat de gebruiker waarschijnlijk verwacht: wat hij netto overhoudt aan inkomsten die
binnenkomen zonder dat hij werkt.

Wat er buiten de berekening valt:
- Hypotheekaflossing op verhuurpand (dit is een "kosten" voor cashflow, maar vermogensbouw)
- Hypotheekrente op verhuurpand (dit is echt een kosten)
- Belasting op huurinkomsten (box 3 / inkomstenbelasting)

**Aanbeveling:**
- Toon de huidige berekening als "Brutaal passief inkomen (vóór hypotheeklasten)"
- Voeg een informatieicoon toe met de toelichting wat er niet in zit
- Hypotheekrente is optioneel toe te voegen als transactietype `mortgage_interest`
  (dit vereist een schema-uitbreiding maar is waardevol)

### 3c. Vermogensontwikkeling grafiek — de lege-data-val

De tijdreeksgrafiek werkt alleen goed bij regelmatige valuatie-invoer. Als de gebruiker
zijn spaargeld één keer per jaar bijwerkt, ziet de grafiek een platte lijn met een sprong.
Dit oogt als een bug maar is een data-kwaliteitsprobleem.

**Aanbeveling:**
- Voeg een "laatste update" indicator toe per asset
- Geef een visuele hint als valuaties ouder zijn dan 90 dagen
- In de grafiek: gestippelde lijn of grijze tint voor periodes zonder nieuwe valuatie

---

## 4. Wat ontbreekt dat een financieel adviseur altijd zou tonen

### 4a. Risicospreiding

De allocatiegrafiek toont spreiding over asset-typen. Maar een adviseur kijkt ook naar:
- Geografische spreiding (NL vs. internationaal)
- Sector-concentratie (als stocks/ETFs meerdere posities bevatten)
- Valutarisico (USD-exposure bij US ETFs)

Dit zijn v2+ overwegingen, maar het datamodel moet ze mogelijk maken.
`stock_etf_details` heeft een `ticker` — op basis daarvan kan later automatisch
geografische spreiding worden berekend.

### 4b. Rendement gecorrigeerd voor risico

XIRR vertelt niks over het risico dat genomen is voor dat rendement. 8% XIRR op
spaargeld (0% risico) is heel anders dan 8% op crypto (hoog risico).

In v1 is dit buiten scope — maar de labels moeten dit impliciet duidelijk maken.
Crypto naast spaargeld in dezelfde tabel met dezelfde rendementkolom is misleidend.

**Actie v1:** voeg een assettype-badge toe die het risicoprofiel aangeeft
(veilig / gemiddeld / volatiel). Geen berekening, gewoon een label.

### 4c. Inflatie-gecorrigeerd rendement

8% XIRR klinkt goed. Met 3% inflatie is het reëel rendement 5%. Dit is een v2-feature
(staat al in finance-logic.md als opengehouden uitbreiding), maar de afwezigheid ervan
moet ergens worden benoemd — zodat de gebruiker weet dat alle getallen nominaal zijn.

**Actie v1:** voeg een vaste voetnoot toe op de vermogenspagina:
"Alle rendementen zijn nominaal (vóór inflatie)."

### 4d. Pensioen — de blinde vlek

Pensioen wordt nu opgenomen in het totaalvermogen via `asset_valuations`. Maar pensioen
is fundamenteel anders dan andere assets:
- Niet vrij opneembaar vóór pensioenleeftijd
- Waarde is een contante-waarde-berekening van toekomstige uitkeringen, geen marktwaarde
- UPO-waarde geeft "gegarandeerde uitkering" — maar die is afhankelijk van levensverwachting

**Aanbeveling:**
- Pensioen apart tonen in het nettovermogengetal — eventueel met een aparte regel
- Geen XIRR berekenen op pensioen (te weinig cashflows, niet zinvol)
- UPO-waarde tonen als "opgebouwde aanspraak" niet als "vermogen"

---

## 5. Checklist per sprint

Gebruik deze vragen bij elke sprint die raakt aan financiële berekeningen of UI:

**Berekeningen:**
- [ ] Is duidelijk of een getal bruto of netto is?
- [ ] Over welke periode is het berekend? Staat dat erbij?
- [ ] Wat gebeurt er als de gebruiker weinig of geen data heeft? Toont het een "—" of crasht het?
- [ ] Is het getal vergelijkbaar met wat een bank of broker ook zou tonen?

**UI / labels:**
- [ ] Begrijpt een niet-financieel geschoolde gebruiker dit getal direct?
- [ ] Zijn er disclaimers nodig (korte periodes, hefboomwerking, benchmark-vergelijking)?
- [ ] Is het risico van het getal zichtbaar (volatiliteit, illiquiditeit)?

**Context:**
- [ ] Heeft de gebruiker genoeg data ingevoerd om dit getal te vertrouwen?
- [ ] Wat doet de app als een externe databron (yahoo-finance) uitvalt?

---

## 6. Bekende risico's en openstaande vragen

| Risico | Ernst | Status | Aanbeveling |
|---|---|---|---|
| XIRR vs. TWR in benchmarkkaart | Hoog | Open | Disclaimer toevoegen aan UI |
| Cash-on-cash zonder hefboomwaarschuwing | Gemiddeld | Open | Toelichting toevoegen |
| Passief inkomen excl. hypotheeklasten | Gemiddeld | Open | Label aanpassen + informatie-icoon |
| Pensioen als regulier vermogen | Gemiddeld | Open | Aparte weergave overwegen |
| Grafiek met schaarse valuatiedata | Laag | Open | Datatijdstempel tonen per asset |
| Korte XIRR-periodes (< 1 jaar) geannualiseerd | Gemiddeld | Open | Minimumperiode of waarschuwing |
| Nominale rendementen (geen inflatie) | Laag | Open | Voetnoot toevoegen |
| Inflatie-effect op spaargeld onzichtbaar | Laag | Open | V2 feature |

---

## 7. Termen en definities (NL)

| Term | Definitie in deze app |
|---|---|
| Netto vermogen | Alle assets minus alle schulden (hypotheken + overige) |
| Beleggingsportefeuille | Liquide assets: aandelen, ETFs, crypto, spaargeld |
| Inleg | Wat de gebruiker zelf heeft ingebracht (exclusief dividend/rente/huur) |
| Rendement | Procentuele maatstaf — altijd nominaal tenzij anders vermeld |
| XIRR | Intern rendement op basis van cashflow-timing — persoonlijk rendement |
| TWR | Tijdgewogen rendement — fondsprestatie, los van stortingstijdstip |
| Passief inkomen | Dividend + rente + nettohuur (excl. hypotheeklasten) |
| Bruto huurrendement | Jaarhuur (bruto) gedeeld door aankoopwaarde |
| Netto huurrendement | (Jaarhuur − kosten) gedeeld door aankoopwaarde |
| Cash-on-cash | Nettohuur gedeeld door eigen inleg (incl. hefboomeffect) |
| LTV | Resterende hypotheek gedeeld door actuele woningwaarde |
| Eigen vermogen vastgoed | Woningwaarde minus resterende hypotheek |
