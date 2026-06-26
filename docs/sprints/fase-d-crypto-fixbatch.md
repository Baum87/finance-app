# Fase D — Fix-batch: Crypto

**Doel:** de goedgekeurde fixes uit de multi-expert crypto-review doorvoeren,
plus één scope-uitbreiding: de silent fallback bij koersfouten voor
transactie-gedreven assets aanpakken.

Bouw alleen wat hieronder staat. SUGGESTIES (S1, S2) niet aanraken.

---

## FIX 1 — K1: EUR-symbool op crypto detailpagina (KRITIEK)

**Probleem:** `src/app/portfolio/crypto/[id]/page.tsx` lijn 29-30 gebruikt
`priceCurrency` (vaak USD) voor de koers-subtext. `priceEur` (de omgerekende
EUR-koers) wordt niet eens gedestructureerd uit `calculations`.

Dit is hetzelfde patroon als FIX3 bij Aandelen — niet doorgetrokken naar de
crypto-pagina.

**Fix:**
- Destructureer `priceEur` uit `calculations`
- Toon de koers-subtext in EUR via `formatCurrency` (zelfde aanpak als bij Aandelen)
- Verwijder de `priceCurrency`-afhankelijkheid uit `fmtPrice`

**Verifieer:** voor een BTC-USD asset toont de koers nu een €-bedrag in nl-NL-opmaak,
niet meer een $-bedrag.

---

## FIX 2 — K2: Ticker silent €0 fix (KRITIEK)

**Probleem:** een gebruiker voert `BTC` in (logische invoer), Yahoo Finance kent
geen ticker `BTC`, de koersophaling faalt, outer catch valt terug op valuation,
nieuw asset = €0. Geen foutmelding.

**Aanpak: normalisatie + vangnet** (gewogen advies van financieel/gebruiker/frontend).

### 2a. Placeholder en helptext
In `src/components/assets/AssetForm.tsx` CryptoSection:
- Placeholder: `BTC-EUR`
- Helptext direct onder het veld: *"Crypto-ticker. Wordt automatisch in euro's
  opgehaald. Voorbeelden: BTC-EUR, ETH-EUR, SOL-EUR."*

### 2b. Normalisatie in de Server Action
In de Server Action die crypto-assets aanmaakt: vóór opslag de ticker normaliseren.

Logica:
- Als de input al een suffix heeft (`-EUR`, `-USD`, etc.): laat staan
- Als de input geen suffix heeft: voeg `-EUR` toe
- Casing: hoofdletters (`btc-eur` → `BTC-EUR`)
- Trim whitespace

Implementatie zo dicht mogelijk bij waar de ticker de DB in gaat. Niet in de
client doen — server-side normalisatie is robuuster.

### 2c. Live-koers vangnet bij aanmaken
Dit is de échte preventie: zelfs als de normalisatie iets niet vangt, valideert
de app direct of de ticker daadwerkelijk een koers kan opleveren.

In de Server Action voor crypto-asset-aanmaken:
1. Normaliseer de ticker (2b)
2. Probeer direct `getLatestPrice(genormaliseerdeTicker)` aan te roepen
3. Slaagt het: ga door met opslaan
4. Faalt het: gooi een duidelijke validatiefout terug naar het formulier:
   *"Geen koers gevonden voor '{ticker}'. Controleer het symbool of voeg het
   handmatig toe via een waarderingsinvoer."*

De foutmelding blokkeert het opslaan en toont een Zod-achtige fout op het
formulier (zelfde mechanisme als andere validatiefouten).

**Verifieer:**
- Invoer `BTC` → wordt `BTC-EUR`, koers opgehaald, asset aangemaakt
- Invoer `btc-eur` → wordt `BTC-EUR`, asset aangemaakt
- Invoer `FAKECOIN` → foutmelding, asset niet aangemaakt
- Invoer `BTC-USD` → blijft `BTC-USD`, asset aangemaakt (gebruiker mag dit
  expliciet kiezen, FX-conversie pakt de USD-→-EUR omrekening)

---

## FIX 3 — K3: netDeposit op crypto overview gebruikt fout (KRITIEK)

**Probleem:** `src/app/portfolio/crypto/page.tsx` gebruikt
`getTransactionsByAssets` (zonder fees-kolom) en berekent netDeposit inline,
waardoor fees worden gemist. Inconsistent met de detailpagina die
`calculateNetDeposit` (mét fees) gebruikt.

**Fix:**
- Vervang `getTransactionsByAssets` door `getTransactionsByAssetsDetailed`
- Vervang de inline netDeposit-berekening door een aanroep van `calculateNetDeposit`
- Gebruik dezelfde Decimal-discipline als elders

**Verifieer:** "Totale inleg" op de crypto-overzichtspagina is nu exact gelijk
aan de som van "Ingelegd" op de individuele asset-detailpagina's.

---

## FIX 4 — V1: Labels niet doorgetrokken naar crypto-pagina's

**Probleem:** FIX2 uit de Aandelen-batch is niet toegepast op crypto-pagina's.

**Fix:**
- `src/app/portfolio/crypto/[id]/page.tsx` lijn 81: `label="XIRR"` → `label="Rendement"`
- Lijn 83: subtext `"Jaarlijks rendement"` → `"Jaarlijks, berekend via XIRR"`
- `src/app/portfolio/crypto/page.tsx` lijn 58: `label="Ongerealiseerde winst"`
  → `label="Rendement (totaal)"`

---

## FIX 5 — V2: Percentage-opmaak via formatPercent

**Probleem:** `src/app/portfolio/crypto/page.tsx` lijn 61 gebruikt
`.mul(100).toDecimalPlaces(1).toNumber()%` — formatteert als `12.3%` in plaats
van nl-NL `12,3%`.

**Fix:** vervang door `formatPercent(value)` uit `@/lib/utils/format`.

---

## FIX 6 — Silent fallback bij koersfout (scope-uitbreiding, geldt OOK voor aandelen)

**Probleem:** voor transactie-gedreven assets (stock_etf, crypto) valt de
huidige-waarde-berekening stilzwijgend terug op de laatste valuation als de
live koers faalt. Voor deze asset-types is de live koers de bron van waarheid —
een falende ophaling is een echte fout die de gebruiker moet zien.

Voor valuation-gedreven assets (savings, real_estate, pension) is de
valuation-fallback wél correct. Daar mag niets aan veranderen.

**Fix in `src/lib/db/queries/assets.ts`** (zowel `getAssetWithCalculations` als
`getAssetsWithValues`):

- Voor `assetType === 'stock_etf' || assetType === 'crypto'`:
  - Als de live-koers-ophaling faalt: gooi geen silent fallback, maar zet een
    expliciete waarschuwingsstatus op het asset (bijv. `priceStatus: 'failed'`
    of een vergelijkbare structuur die in de UI gevisualiseerd kan worden)
  - De `currentValue` mag dan `null` of de laatste valuation zijn, maar de UI
    krijgt een signaal dat de live koers gefaald heeft
- Voor `savings | real_estate | pension`: gedrag onveranderd (valuation is
  bron van waarheid)

**UI-consequentie:** op de detailpagina's voor stock_etf en crypto wordt een
kleine waarschuwing getoond als `priceStatus === 'failed'`:
*"Live koers niet beschikbaar. Waarde gebaseerd op laatste bekende waardering."*

Stijl: subtext in `--color-text-secondary`, geen alarm-rood. Past bij
calm-executive-filosofie.

**Niet doen:** geen retry-logic, geen background polling. Eén poging, duidelijke
status, gebruiker beslist.

---

## NIET in deze batch

- **S1** — `getTransactionsByAssets` vs `getTransactionsByAssetsDetailed` samenvoegen (backlog refactor)
- **S2** — portfolio-XIRR op crypto-overview (backlog)
- **F1-crypto, F2-crypto, F3-crypto** — gaan naar het fiscale contract, niet bouwen

---

## Proces-notitie voor volgende fixes

Dit is de **tweede review op rij** waarin fixes die bij Aandelen zijn
doorgevoerd, niet automatisch zijn toegepast op crypto (K1 en V1 zijn beide
exact dezelfde patronen). Niet zomaar overdoen — kijk vooraf bredere.

**Convention voor toekomstige fixes:** wanneer een fix raakt aan een patroon
dat in meerdere pagina's of componenten voorkomt (labels, valutasymbolen,
formatters, format-helpers), zoek expliciet naar **alle** plekken waar dat
patroon voorkomt vóór de fix wordt afgerond. Niet alleen de pagina die in de
review aan bod kwam.

Concreet voor deze batch: na FIX1 en FIX4 een laatste check uitvoeren:
```bash
grep -rn "asset\.currency\|priceCurrency\|XIRR\|Ongerealiseerde" src/app/ src/components/
```

Geen resultaten op pagina's die nog gepatcht moeten worden.

---

## Verificatie

```bash
npx tsc --noEmit
npm run test
```

FIX 6 raakt logica — eventueel komen er testfailures door de nieuwe
`priceStatus`-structuur. Als dat gebeurt: pas de testfixtures aan zodat ze de
nieuwe structuur dekken. Tests die de bestaande berekeningen testen
(43 finance-tests) mogen niet breken.

---

## Commit

Twee commits voor leesbaarheid:

```bash
# Commit 1 — pure crypto-fixes
git add -A
git commit -m "fix(crypto): EUR symbol, ticker normalization, netDeposit fees, label parity"

# Commit 2 — scope-uitbreiding silent fallback
git commit -m "fix(prices): surface price fetch failures for transaction-driven assets"
```

(Of als één commit als dat eenvoudiger is — pragmatisch.)

---

## Daarna

Crypto is afgesloten. Volgende: Spaarrekening — eenvoudiger onderdeel,
valuation-based, geen koersophaling. Het patroon van de drie-experts-review
blijft hetzelfde.
