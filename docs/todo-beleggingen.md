# Todo — Beleggingen pagina

Vastgelegd op basis van gesprek 12 juni 2026.
Dit is een volledige herontwikkeling van de beleggingssectie.

---

## Visie

Een aparte `/beleggingen` pagina die beleggingen organiseert per broker,
met volledige analyse: rendement, inleg vs winst, sectoren, risico en een
geprojecteerde groeilijn. Transactiebeheer zit op dezelfde pagina.

Huidige `/vermogen` pagina heroverwegen of samenvoegen zodra dit af is.

---

## Fase 1 — Fundament: Broker als entiteit

- [ ] `brokers` tabel toevoegen aan schema (naam, logo?, notes)
- [ ] `brokerId` FK toevoegen aan `assets` (stock_etf assets)
- [ ] Migratie + RLS voor nieuwe tabel
- [ ] AssetForm updaten: broker-dropdown i.p.v. vrij tekstveld
- [ ] Bestaande broker-tekstwaarden migreren naar nieuwe entiteit

---

## Fase 2 — Nieuwe `/beleggingen` pagina (structuur)

- [ ] Route `/beleggingen` aanmaken
- [ ] Navigatie-item toevoegen in Topbar
- [ ] Pagina-structuur: per broker een sectie, daarbinnen assets
- [ ] Per asset: naam, ticker, sub-type, huidige waarde, rendement (XIRR)
- [ ] Transactiebeheer inline op deze pagina (kopen/verkopen/dividend)
- [ ] Asset aanmaken inclusief eerste aankoop (één formulier, één submit)
  - Ticker zoeken via Yahoo Finance → auto-fill naam + ticker
  - Eerste aankoop: aantal, aankoopprijs, datum, transactiekosten
  - Huidige koers vooringevuld vanuit Yahoo (aanpasbaar)

---

## Fase 3 — Asset metadata uitbreiden

- [ ] Sub-type veld toevoegen aan `stock_etf_details`: `aandeel` / `etf` / `indexfonds`
- [ ] Sector veld toevoegen (tech, energie, healthcare, financieel, etc.)
- [ ] DCA-vlag op transacties: `is_recurring: boolean`
  - Bij aanmaken transactie: "Herhaal elke maand" checkbox
  - Weergave: DCA-posities apart zichtbaar, inclusief inlegtotaal

---

## Fase 4 — Analyse en grafieken

- [ ] **Gemiddelde aankoopprijs per positie** tonen
  - Cruciaal bij DCA: "gem. €94,20 gekocht, nu €108"
- [ ] **Inleg vs winst grafiek** (lijndiagram, beide lijnen in één grafiek)
  - X-as: tijd, Y-as: euro's
  - Lijn 1: cumulatieve inleg
  - Lijn 2: werkelijke portefeuillewaarde
- [ ] **Geprojecteerde lijn** (fase A: extrapoleer historische CAGR)
  - Stippellijn vanaf vandaag op basis van gemiddeld behaald rendement
  - Later uitbreiden naar beta × marktrendement (fase B)
- [ ] **Sector-diagram** (donut of horizontale balken)
- [ ] **Risico-diagram** — beta/volatiliteit ophalen via Yahoo Finance
  - `yf.quoteSummary(ticker, { modules: ['defaultKeyStatistics'] })` geeft beta
  - Posities indelen: laag / middel / hoog risico
- [ ] **Asset-type diagram**: aandelen vs ETFs vs indexfondsen
- [ ] **Dividend apart zichtbaar** in rendement-opsplitsing
  - Waardestijging vs inkomen (dividend/rente)
- [ ] **Per-broker totaalrendement**

---

## Fase 5 — Later / nice to have

- [ ] Valuta-impact berekenen (EUR/USD effect op USD-posities)
- [ ] Break-even prijs per positie
- [ ] Geprojecteerde lijn fase B: beta × marktrendement + eigen alpha
- [ ] Benchmark per broker of sub-portfolio instellen

---

## Openstaande beslissingen

- Wat gebeurt er met de huidige `/vermogen` pagina zodra `/beleggingen` af is?
  → Samenvoegen, of `/vermogen` behouden als "netto vermogen totaal" en `/beleggingen` als detailpagina?

---

## Wat al werkt en hergebruikt kan worden

- XIRR-berekening per asset ✓
- Transactiehistorie per asset ✓
- Yahoo Finance prijzen + historische data ✓
- Allocatiedonut component ✓
- NetWorthChart component ✓
- Benchmark (URTH TWR) ✓
