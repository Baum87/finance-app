# Sprint 3.5 — Aandelen & ETF flow: overzicht, broker, positie

**Datum:** 13–14 juni 2026
**Status:** Afgerond

---

## Doel van deze sprint

De volledige drie-niveau flow van Aandelen & ETFs herbouwen en verfijnen:
- Informatie per niveau logisch afbakenen (wat zie je waar?)
- Visuele hiërarchie verduidelijken met consistente breadcrumbs
- Inleg-berekening bug fixen (gross buys → netto buys minus sells)
- KPI-tegels per niveau saneren (minder herhaling)

---

## Architectuurbeslissing — drie niveaus

| Niveau | URL | Vraag die het beantwoordt |
|---|---|---|
| Algemeen | `/portfolio/aandelen-etf` | Hoe staat mijn totale aandelenportefeuille ervoor? |
| Broker | `/portfolio/aandelen-etf/broker/[id]` | Welke posities heb ik bij broker X en hoe presteren die? |
| Positie | `/portfolio/aandelen-etf/[id]` | Hoe doet dit specifieke aandeel het en wat heb ik gedaan? |

**Vuistregel per niveau:**
- Niveau 1 → totalen + trend + allocatie + broker-vergelijking
- Niveau 2 → broker-samenvatting + positielijst (geen grafiek, herhaling)
- Niveau 3 → positie-detail + transacties (geen grafiek, te weinig data)

---

## Wat is gebouwd / gewijzigd

### Gedeelde infrastructuur (eerder in deze sprint)

**`src/lib/finance/stock-series.ts`** (nieuw)
- `buildStockPortfolioSeries(txs, tickerByAssetId)` — gedeelde functie voor historische portefeuille-grafiek
- Haalt historische prijzen per ticker op via Yahoo Finance
- Converteert niet-EUR koersen via `${currency}EUR=X` wisselkoers
- Bouwt maandelijkse `{ month, inleg, waarde }` reeks op (netto inleg = buys − sells)
- Gebruikt door zowel broker-detailpagina als overzichtspagina

**`src/components/portfolio/AllocationBreakdown.tsx`** (nieuw)
- Gestapelde kleurenbalk + legenda met bedrag en percentage
- Props: `title: string`, `items: AllocationItem[]`
- Kleuren via CSS-variabelen: `--color-steel`, `--color-sage`, `--color-terracotta`, `--color-gold`

### Niveau 1 — `src/app/portfolio/aandelen-etf/page.tsx`

**KPI-tegels (4):**
- Marktwaarde — live koersen
- Netto inleg — buys minus sell-opbrengsten
- Winst/verlies — marktwaarde minus netto inleg (groen/rood + % als subtext)
- Rendement % — op netto inleg

**Grafiek:**
- Twee lijnen: inleg (steel) en marktwaarde (sage)
- Fallback naar enkelvoudige inleg-lijn als historische koersen niet beschikbaar

**Allocatie (side-by-side):**
- Sector-verdeling op marktwaarde
- Type instrument (Aandelen / ETFs / Indexfondsen)

**Broker-lijst:**
- Naam · posities · waarde · netto inleg · W/V · %
- Klikbaar naar broker-detailpagina

**Bug gefixed:** `nettoInleg = buys − sell-opbrengsten` — eerder werden alleen aankopen geteld, waardoor W/V incorrect was bij posities waarbij ook verkopen waren gedaan.

### Niveau 2 — `src/app/portfolio/aandelen-etf/broker/[id]/page.tsx`

**Breadcrumb:** `Aandelen & ETFs › [Broker naam]`

**KPI-tegels (3, was 4):**
- Marktwaarde
- Winst/verlies (+ % als subtext)
- Rendement %
- *Netto inleg-tegel verwijderd* — herhaling van niveau 1, minder informatief op dit niveau

**Grafiek verwijderd** — was herhaling van de grafiek op niveau 1; de posities-tabel geeft voldoende inzicht

**Posities-tabel (`BrokerPositionsTable`):**
- Naam · ticker · sector · type · waarde · W/V · %
- W/V per positie op basis van netto inleg (buys − sells per asset)
- Sorteerbaar op alle kolommen

### Niveau 3 — `src/app/portfolio/aandelen-etf/[id]/page.tsx`

**Breadcrumb:** `Aandelen & ETFs › [Broker] › [Naam]` (beide links klikbaar)
- Broker-link wordt opgezocht via `getBrokers()` op basis van `stockEtfDetails.broker`

**KPI-tegels (6 in 2 rijen × 3, was 8 in 2 rijen × 4):**

*Rij 1 — portfolio-prestatie:*
- Marktwaarde (+ koers als subtext)
- Winst/verlies € (+ % als subtext)
- Jaarrendement — XIRR, min. 30 dagen

*Rij 2 — positie-details:*
- Aantal in bezit
- Gem. aankoopkoers — WAC via AVCO
- Huidige koers in EUR (+ native valuta als subtext bij niet-EUR)

**Verwijderd:**
- "Transacties (aantal)"-tegel — nutteloze info, lijst staat direct eronder
- "Totale inleg"-tegel — zit impliciet in W/V (marktwaarde − inleg = W/V)
- Broker niet meer in subheader (staat nu in breadcrumb)

**Transactielijst:**
- Knoppen: + Kopen · Verkopen
- Per-lot W/V wanneer huidige koers beschikbaar is

---

## Inleg-berekening: de bug en de fix

**Probleem:**
```
totaleInleg = sum(buy.amount)           // gross: alle aankopen
winstVerlies = currentValue - totaleInleg
```

Bij verkopen was `currentValue` alleen de resterende positie, maar `totaleInleg` bevatte het volledige aankoopbedrag inclusief verkochte aandelen → W/V klopte niet.

**Voorbeeld:**
- Koop 10 aandelen voor €2.000
- Verkoop 5 aandelen voor €900 (realiseer €100 winst)
- Resterende 5 aandelen nu €1.100 waard

Oud: W/V = €1.100 − €2.000 = **−€900** ❌
Nieuw: W/V = €1.100 − (€2.000 − €900) = **+€0** ✓ *(break-even op de resterenden)*

**Fix:**
```typescript
const nettoInlegByAsset = new Map<string, Decimal>()
for (const tx of detailedTxs) {
  const prev = nettoInlegByAsset.get(tx.assetId) ?? new Decimal(0)
  if (tx.transactionType === 'buy')  nettoInlegByAsset.set(tx.assetId, prev.plus(tx.amount))
  if (tx.transactionType === 'sell') nettoInlegByAsset.set(tx.assetId, prev.minus(tx.amount))
}
```

Toegepast op: niveau 1 KPI's, niveau 1 broker-lijst, niveau 2 KPI's, niveau 2 posities-tabel.
Niveau 3 gebruikte al `netDeposit` (= `calculateNetDeposit` uit finance-library) — was al correct.

---

## Openstaand (todo.md)

- **Andere transactie (dividend, kosten, splits)** — het generieke `TransactionForm` werkt nog niet volledig; geen auto-berekening, valuta/wisselkoers UX ruw, sluit niet aan op EUR-opslag aanpak.
