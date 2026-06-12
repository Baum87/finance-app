# finance-logic.md — Personal Finance App

Laatst bijgewerkt: 11 juni 2026
Status: definitief vastgesteld (Sprint 1.3)

Dit document is het **contract** voor `lib/finance`. Elke functie hier beschreven
wordt geïmplementeerd in pure TypeScript en getest tegen de testcases hieronder.
Geen React, geen Drizzle, geen Supabase — alleen data in, getal/object uit.

---

## 0. Contractafspraken

| Onderwerp | Afspraak |
|---|---|
| Rendementen | Decimaal: `0.07` = 7%. UI doet ×100 voor weergave. |
| Bedragen | `number` in TS voor berekeningen. Nooit `0.1 + 0.2` toestaan op geldbedragen. Gebruik `Decimal`-library (bijv. `decimal.js`) voor tussenberekeningen waar precisie kritisch is. |
| Afronden | Uitsluitend bij weergave. Nooit in tussenberekeningen. |
| Fouten | Finance-functies gooien een `Error` met duidelijke melding bij ongeldige input. Nooit stilletjes `NaN` of `0` teruggeven. |
| Datums | ISO-strings `'YYYY-MM-DD'` als input. Intern rekenen met `Date`-objecten of dag-nummers. |

---

## 1. Netto inleg per asset

### Definitie
```
netto_inleg = som(instroom-transacties) − som(uitstroom-transacties)

instroom:  buy, deposit
uitstroom: sell, withdrawal
```

Dividend, rente, huurinkomsten en kosten tellen *niet* mee als inleg — dat is rendement.

### Waarom dit telt
Dit is het fundament van "inleg vs. rendement": hoeveel heb jij erin gestopt, wat heeft het geld zelf gedaan? Zonder netto_inleg kun je het niet splitsen.

### Functie-interface
```typescript
function calculateNetDeposit(transactions: Transaction[]): number
```

### Testcase
```
transactions:
  buy  €10.000  2022-01-01
  buy   €5.000  2022-06-01
  sell  €3.000  2023-01-01

verwacht: 10.000 + 5.000 − 3.000 = €12.000
```

---

## 2. Huidige waarde per asset

### Definitie per assettype

**Transactie-gedreven (stock_etf, crypto):**
```
bezit = som(units bij buy) − som(units bij sell)
waarde = bezit × meest recente koers in EUR
```
Koers omgezet naar EUR via `fx_rates` als currency ≠ EUR.

**Handmatig gewaardeerd (savings, real_estate, pension):**
```
waarde = meest recente asset_valuations.value op of voor peildatum
```

### Functie-interface
```typescript
function calculateCurrentValue(
  asset: Asset,
  transactions: Transaction[],       // voor stock_etf / crypto
  latestValuation: Valuation | null, // voor savings / real_estate / pension
  latestPrice: number | null,        // koers in EUR op peildatum
): number
```

### Testcase — stock_etf
```
transactions:
  buy  50 units  op 2023-01-01
  buy  20 units  op 2023-06-01
  sell 10 units  op 2024-01-01

bezit = 50 + 20 − 10 = 60 units
koers = €48,20
waarde = 60 × 48,20 = €2.892,00
```

### Testcase — savings (valuation-based)
```
meest recente valuation: €15.340,00 op 2024-11-30
verwacht: €15.340,00
```

---

## 3. Netto vermogen

### Definitie
```
netto_vermogen = som(waarde per actief asset) − som(schulden)

schulden:
  − hypotheek:       meest recente mortgage_balances.balance per actieve hypotheek
  − overige schulden: liabilities.current_balance (actief)
```

### Functie-interface
```typescript
function calculateNetWorth(
  assets: AssetWithValue[],      // asset + voorberekende huidige waarde
  mortgageBalances: number[],    // resterende saldi actieve hypotheken
  liabilities: number[],         // saldi overige schulden
): NetWorthResult

type NetWorthResult = {
  totalAssets: number
  totalLiabilities: number
  netWorth: number
}
```

### Testcase
```
assets (waarden):
  VWRL:                €24.100,00
  BTC:                 €14.000,00
  Spaarrekening ING:   €15.000,00
  Appartement:        €325.000,00
  Eigen woning:       €420.000,00

schulden:
  Hypotheek appartement:   €180.000,00
  Hypotheek eigen woning:  €310.000,00

totalAssets      = 24.100 + 14.000 + 15.000 + 325.000 + 420.000 = €798.100,00
totalLiabilities = 180.000 + 310.000 = €490.000,00
netWorth         = €308.100,00
```

---

## 4. Allocatie & liquide/vastgezet

### Allocatie per assetklasse
```
allocatie(type) = som(waarde assets van type) / totalAssets
```

### Liquide vs. vastgezet
```
liquide   = som(waarde assets waar is_liquid = true)
vastgezet = som(waarde assets waar is_liquid = false)
```

`is_liquid`: `stock_etf`, `crypto`, `savings` → true. `real_estate`, `pension` → false.

### Functie-interface
```typescript
function calculateAllocation(assets: AssetWithValue[]): AllocationResult

type AllocationResult = {
  byType: Record<AssetType, { value: number; percentage: number }>
  liquid: { value: number; percentage: number }
  illiquid: { value: number; percentage: number }
}
```

### Testcase
```
VWRL (stock_etf, liquide):     €24.100
BTC (crypto, liquide):         €14.000
Spaarrekening (savings, liq.): €15.000
Appartement (real_estate):    €325.000
Eigen woning (real_estate):   €420.000
Totaal:                       €798.100

stock_etf:    24.100 / 798.100 = 3,02%
crypto:       14.000 / 798.100 = 1,75%
savings:      15.000 / 798.100 = 1,88%
real_estate: 745.000 / 798.100 = 93,35%

liquide:      53.100 / 798.100 =  6,65%
vastgezet:   745.000 / 798.100 = 93,35%
```

---

## 5. Passief inkomen

### Definitie
```
passief_inkomen(periode) =
    som(dividend-transacties in periode)
  + som(interest-transacties in periode)
  + som(rental_income-transacties in periode)
  − som(cost-transacties in periode)   [vastgoedkosten]
```

Geeft het werkelijke netto passieve inkomen over een periode (maand, jaar).

### Functie-interface
```typescript
function calculatePassiveIncome(
  transactions: Transaction[],
  from: string,   // 'YYYY-MM-DD'
  to: string,
): PassiveIncomeResult

type PassiveIncomeResult = {
  dividend: number
  interest: number
  rentalIncome: number
  rentalCosts: number
  netPassiveIncome: number
}
```

### Testcase
```
2024:
  dividend VWRL:       €420,00
  rente spaarrekening: €310,00
  huur appartement: €12.000,00
  kosten appartement: −€2.400,00

netPassiveIncome = 420 + 310 + 12.000 − 2.400 = €10.330,00
```

---

## 6. XIRR — Intern rendement

### Gebruik
Het **primaire rendementsgetal** per asset en voor het totaalportfolio.
Beantwoordt: *wat heeft mijn geld mij opgeleverd, gegeven mijn eigen in- en uitstap-timing?*

Niet verwarren met TWR — zie sectie 7.

### Definitie
De disconteringsvoet `r` waarvoor geldt:
```
∑ [ Cᵢ / (1 + r)^((dᵢ − d₀) / 365) ] = 0
```
`Cᵢ` = cashflow op datum `dᵢ`. `d₀` = vroegste datum in de reeks.

### Cashflow-conventie
| Transactietype | Teken XIRR |
|---|---|
| buy, deposit, cost | negatief (geld uit) |
| sell, withdrawal, dividend, interest, rental_income | positief (geld in) |
| Sluitcashflow (open positie) | positief: huidige waarde op peildatum |

Voor een **open positie** voeg je altijd een sluitcashflow toe:
```
sluitcashflow = +huidige_waarde  op  peildatum (vandaag)
```

### Implementatie
Newton-Raphson iteratie:
- Startwaarde: `r = 0.1`
- Max iteraties: 100
- Convergentiedrempel: `|NPV(r)| < 1e-7`

### Randgevallen
```
< 2 cashflows                   → Error('XIRR requires at least 2 cashflows')
Alle cashflows zelfde teken     → Error('XIRR requires mixed cashflows')
Geen convergentie na 100 iter.  → Error('XIRR did not converge')
amount = 0                      → cashflow weglaten (effect nul)
```

### Functie-interface
```typescript
function calculateXirr(cashflows: Cashflow[]): number

type Cashflow = {
  amount: number   // positief of negatief conform tabel hierboven
  date: string     // 'YYYY-MM-DD'
}
```

### Testcase A — enkelvoudig, 1 jaar
```
−€10.000 op 2024-01-01
+€10.700 op 2025-01-01

verwacht: 0,0700 (7,00%)
tolerantie: |resultaat − 0,07| < 0,0001
```

### Testcase B — gespreide aankopen
```
−€5.000  op 2023-01-01
−€3.000  op 2023-07-01
+€10.000 op 2025-01-01

verwacht: ≈ 0,1554  (verifiëren met Excel XIRR)
tolerantie: 0,0001
```

### Testcase C — dividend tussendoor
```
−€10.000 op 2023-01-01
+€300    op 2023-12-31  (dividend)
+€11.200 op 2025-01-01  (verkoop)

verwacht: ≈ 0,1065
tolerantie: 0,0001
```

### Testcase D — foutpad
```
input: één cashflow  → Error('XIRR requires at least 2 cashflows')
input: alle negatief → Error('XIRR requires mixed cashflows')
```

---

## 7. TWR — Time-Weighted Return

### Gebruik
**Uitsluitend voor benchmark-vergelijking.**
Zuivert het effect van jouw stortings-/onttrekkingstiming eruit, zodat je je *fondskeuze*
eerlijk tegen een index kunt leggen. Niet tonen als primair rendementsgetal — XIRR is dat.

### Definitie
```
TWR = ∏(1 + Rₚ) − 1

waarbij Rₚ = (Eindwaarde − Beginwaarde − Netto_instroom) / Beginwaarde
```
Elke storting of onttrekking markeert het einde van een sub-periode en het begin van de volgende.

### Randgevallen
```
Beginwaarde sub-periode = 0       → eerste sub-periode begint op stortingsdatum; Rₚ = 0
Geen sub-periodes                  → TWR = 0
Negatieve beginwaarde              → Error('TWR: negative beginning value')
```

### Functie-interface
```typescript
function calculateTwr(subPeriods: TwrSubPeriod[]): number

type TwrSubPeriod = {
  beginValue: number
  endValue: number
  netInflow: number  // positief = storting, negatief = onttrekking
}
```

### Testcase A — één periode
```
begin: €10.000, einde: €11.000, instroom: €0
Rₚ = (11.000 − 10.000 − 0) / 10.000 = 0,10
TWR = 0,10 (10%)
```

### Testcase B — twee sub-periodes met storting
```
sub-periode 1: begin €10.000 → einde €11.000, instroom €0       → Rₚ = 0,10
               [storting €2.000 → nieuw begin €13.000]
sub-periode 2: begin €13.000 → einde €14.300, instroom €0       → Rₚ = 0,10

TWR = (1,10 × 1,10) − 1 = 0,21 (21%)
```

---

## 8. Benchmark-vergelijking

### Definitie
```
outperformance = portfolio_twr − benchmark_twr
```

Beide TWR berekend over **exact dezelfde sub-periodes** (de stortings-/onttrekkingsdatums
van het portfolio bepalen de snijpunten).

### Implementatie-aanpak
1. Bepaal sub-periode-grenzen o.b.v. portfolio-cashflows.
2. Haal benchmark-sluitkoersen op voor elke grens (koersdataservice, Sprint 3.2).
3. Bereken TWR benchmark over dezelfde sub-periodes.
4. Bereken outperformance.

Default benchmark: `'MSCI World'` (via `stock_etf_details.benchmark`).

### Testcase
```
portfolio_twr:  0,12 (12%)
benchmark_twr:  0,09 (9%)
outperformance: 0,03 (3 procentpunten — niet 3%)
```

---

## 9. Cost basis (gemiddelde aankoopkoers)

### Keuze: gemiddelde methode, niet FIFO
NL box-3 belast vermogen, niet gerealiseerde winst → FIFO-complexiteit voegt niets toe in v1.
Gemiddelde cost basis volstaat en is intuïtiever voor de gebruiker.

### Definitie
```
gemiddelde_kostprijs = som(buy.amount + buy.fees) / som(buy.units)
ongerealiseerde_winst = (huidige_koers − gemiddelde_kostprijs) × huidig_bezit
```

### Testcase
```
buy  100 units à €40,00 + €5,00 fees → kostprijs: €4.005,00
buy   50 units à €44,00 + €3,00 fees → kostprijs: €2.203,00

totale kostprijs: €6.208,00
totale units:     150

gemiddelde_kostprijs = 6.208 / 150 = €41,387 per unit

huidige koers: €48,20
ongerealiseerde_winst = (48,20 − 41,387) × 150 = €1.021,95
```

---

## 10. Vastgoedrendement

### 10a. Bruto huurrendement
```
bruto_huurrendement = jaarhuur_bruto / aankoopwaarde

jaarhuur_bruto = som(rental_income transacties in jaar X)
aankoopwaarde  = purchase_price + purchase_costs
```

### 10b. Netto huurrendement
```
netto_huurrendement = jaarhuur_netto / aankoopwaarde

jaarhuur_netto = som(rental_income) − som(cost)  [in periode]
```

### 10c. Cash-on-cash rendement (rendement op eigen inleg)
```
eigen_inleg = purchase_price + purchase_costs − hypotheek_origineel_bedrag

cash_on_cash = jaarhuur_netto / eigen_inleg
```
Dit is het rendement op wat jij **zelf** hebt ingebracht — laat de hefboom zien.

### 10d. LTV — Loan-to-Value
```
ltv = resterende_hypotheek / actuele_woningwaarde
```
Daalt naarmate je aflost en/of de waarde stijgt. Risicometer.

### 10e. Totaalrendement vastgoed (XIRR-based)
Cashflows:
```
−(purchase_price + purchase_costs)   op purchase_date
+jaarhuur_netto per jaar             (gesommeerd als jaarlijkse cashflow)
+(actuele_waarde − resterende_hypotheek)  op peildatum  [sluitcashflow]
```

Let op: sluitcashflow is equity, niet de volledige woningwaarde. Je rekent op eigen vermogen.

### Functie-interfaces
```typescript
function calculateRentalYield(
  annualRentalIncome: number,
  annualCosts: number,
  purchasePrice: number,
  purchaseCosts: number,
): RentalYieldResult

type RentalYieldResult = {
  grossYield: number       // bruto huurrendement
  netYield: number         // netto huurrendement
  cashOnCash: number       // rendement op eigen inleg
  ltv: number              // loan-to-value
}

function calculateRealEstateTotalReturn(cashflows: Cashflow[]): number
// hergebruikt calculateXirr
```

### Testcase
```
Gegevens:
  purchase_price:     €280.000
  purchase_costs:      €8.400
  aankoopwaarde:      €288.400
  hypotheek:          €224.000  (80% LTV bij aankoop)
  eigen_inleg:         €64.400  (288.400 − 224.000)

  huurinkomsten 2024:  €12.000
  kosten 2024:          €2.400   (VvE, onderhoud, verzekering)
  jaarhuur_netto:       €9.600

  actuele waarde:     €325.000
  resterende hyp.:    €180.000

Resultaten:
  bruto_huurrendement = 12.000 / 288.400 = 4,16%
  netto_huurrendement =  9.600 / 288.400 = 3,33%
  cash_on_cash        =  9.600 /  64.400 = 14,91%
  ltv                 = 180.000 / 325.000 = 55,38%

Totaalrendement (XIRR, aankoop 2020-01-15 t/m 2024-12-31):
  cashflows:
    −€288.400  op 2020-01-15
    +€8.400    op 2020-12-31  (nettohuur jaar 1)
    +€9.000    op 2021-12-31
    +€9.300    op 2022-12-31
    +€9.600    op 2023-12-31
    +€9.600    op 2024-12-31
    +€145.000  op 2024-12-31  (equity sluit: 325.000 − 180.000)
  verwacht XIRR: ≈ 8,2%
  tolerantie: 0,001
```

---

## 11. Vermogensontwikkeling (tijdreeks)

### Definitie
Geen aparte snapshot-tabel in v1. Berekend on-the-fly door `calculateNetWorth` aan te
roepen voor elke gewenste peildatum.

```
voor elke maandpunt M:
  netWorth(M) = calculateNetWorth(
    assets met waarde op M,
    hypotheeksaldi op M,
    overige schulden op M
  )
```

Geeft een array van `{ date, netWorth }` punten voor de grafiek.

### Peildatum-logica per assettype
- **stock_etf / crypto:** bezit op M × koers op M (of dichtste beschikbare koers ≤ M)
- **savings / real_estate / pension:** dichtste `asset_valuations.value` ≤ M
- **Hypotheek:** dichtste `mortgage_balances.balance` ≤ M

---

## 12. Inleg vs. rendement (vermogenssplitsing)

### Definitie
```
cumulatieve_inleg(peildatum)  = som(netto_inleg per asset t/m peildatum)
rendement_component           = totalAssets − cumulatieve_inleg
```

Dit geeft de splitsing die toont hoe vermogen is opgebouwd:
- Inleg = wat jij hebt ingebracht
- Rendement = wat je geld heeft gedaan

### Testcase
```
VWRL:
  buy €10.000  2022-01-01
  buy  €5.000  2023-01-01
  dividend €300 (telt niet als inleg)
  huidige waarde: €18.500

netto_inleg:        €15.000
rendement_component: €3.500   (18.500 − 15.000)
```

---

## Opengehouden uitbreidingen

| Uitbreiding | Status |
|---|---|
| Reëel rendement (na inflatie) | Toevoegen als inflatieparameter aan XIRR/TWR; geen schema-aanpassing |
| Belastinginzicht box 3 | Aparte berekening op basis van `tax_box` en `tax_year`; schema klaar |
| FIFO cost basis | Optioneel toevoegen naast gemiddelde methode in latere versie |
| Scenarioberekeningen (doelen) | Fase 4 — Claude API |
