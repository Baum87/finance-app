# Todo — Aandelen/ETF v1 (archief)

> Gearchiveerd: alle punten zijn afgerond, incl. de broker-FK-migratie
> (`stockEtfDetails.brokerId` is inmiddels een FK naar `brokers`).

## Aandelen / ETF

- [x] **Andere transactie (dividend, kosten)** — `TransactionForm` opgeschoond: valuta/wisselkoers-velden verwijderd (altijd EUR opgeslagen via hidden fields). `allowedTypes` prop toegevoegd; voor aandelen/ETF worden nu alleen `dividend` en `cost` getoond. Bedrag-veld neemt volle breedte in als er geen quantity-velden zijn. (Splits vereisen een apart schema-type — buiten scope v1.)
- [x] **Fees opnemen in kostprijs en netto inleg** — fees worden nu meegenomen in `calculateCostBasis`, `calculateNetDeposit` en `cumInleg` in `stock-series.ts`. Alle callers bijgewerkt.
- [x] **Dividenden als positieve cashflow in XIRR** — geverifieerd: `dividend` zit al in `XIRR_INFLOWS` in `getAssetWithCalculations`. Correct afgehandeld op detail-niveau. (Note: `getLiquidAssetsWithCalculations` mist dividenden nog in de portefeuille-overzicht XIRR.)
- [x] **Bug `month + '-31'` in `stock-series.ts`** — opgelost: `monthEnd` wordt nu berekend via `new Date(y, mm, 0)` — de werkelijke laatste dag van de maand.
- [x] **`cumInleg` bij SELL gebruikt WAC-kostprijs** — opgelost: `costHeld` map bijgehouden naast `qtyHeld`. Bij verkoop wordt nu `WAC × qty` afgetrokken van `cumInleg` i.p.v. de verkoopopbrengst. Grafiek toont nu consistente historische inleg-lijn.
- [ ] **Broker koppeling via naam-string i.p.v. FK** — `stockEtfDetails.broker` is een `text`-veld. Bij hernoeming van een broker kloppen alle posities niet meer. Idealiter wordt dit een `brokerId` FK naar de `brokers` tabel.
- [x] **FX fallback `1` vervangen door `null`** — opgelost: `priceEurAt` geeft nu `null` terug als er geen wisselkoers beschikbaar is, zodat de grafiek het datapunt weglaat i.p.v. USD als EUR te behandelen.
