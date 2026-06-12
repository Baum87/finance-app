# context.md — Personal Finance App

Laatst bijgewerkt: 11 juni 2026

---

## Doel van de app

Een persoonlijke finance-app als **one-stop-shop** voor het bijhouden van vermogen, beleggingen en vastgoed. De app vervangt spreadsheets en geeft één centraal overzicht van de financiële situatie.

**Gebruikspatroon:** maandelijkse review-sessies, met incidentele invoer tussendoor. Geen dagelijkse tool — wel een betrouwbare thuisbasis voor de maandelijkse financiële check-in.

**Noord-ster:** op elk moment weten hoe het totale vermogen ervoor staat, begrijpen wat beleggingen en vastgoed werkelijk opleveren, en per maand zien of je op koers ligt naar financiële doelen — allemaal op één plek, zonder spreadsheets.

---

## North star metrics

De app is succesvol als de gebruiker na een maandelijkse review-sessie antwoord heeft op:

1. **Wat is mijn totale netto vermogen vandaag?** — en hoe is dat veranderd t.o.v. vorige maand en vorig jaar?
2. **Wat leveren mijn beleggingen en vastgoed werkelijk op?** — rendement per asset, per jaar, vs. benchmark.
3. **Lig ik op koers?** — cashflow en vermogensontwikkeling t.o.v. persoonlijke doelen.

---

## Asset-typen (in scope)

| Asset-type | Notities |
|---|---|
| **Aandelen & ETFs** | Meerdere brokers, koersdata nodig, rendement vs. benchmark |
| **Crypto** | Meerdere wallets/exchanges mogelijk |
| **Spaarrekeningen & deposito's** | Meerdere banken, rente bijhouden |
| **Vastgoed — eigen woning** | Woningwaarde (WOZ / geschatte marktwaarde), hypotheek |
| **Vastgoed — verhuurappartement** | Woningwaarde + huurinkomsten + kosten + werkelijk rendement |
| **Pensioen** | Opbouw bijhouden (werkgeverspensioen, lijfrente) — beperkte mutaties |

### Vastgoed als speciaal geval
Vastgoed is het meest complexe asset-type en krijgt eigen logica:
- **Woningwaarde** — handmatig bijwerken (bijv. jaarlijks o.b.v. WOZ of taxatie)
- **Cashflow verhuur** — huurinkomsten min kosten (onderhoud, VvE, verzekering, belasting)
- **Netto huurrendement** — jaarlijkse nettohuur / aankoopwaarde
- **Totaalrendement** — nettohuur + waardestijging / totaal geïnvesteerd vermogen

---

## Berekeningen (in scope)

| Berekening | Beschrijving |
|---|---|
| **Netto vermogen** | Som van alle assets minus schulden (hypotheek, etc.) |
| **Rendement per jaar** | Jaarlijks overzicht per asset en totaalportfolio |
| **Vastgoedrendement** | Netto huurrendement + totaalrendement incl. waardestijging |
| **Benchmark vergelijking** | Portfolio rendement vs. MSCI World (of andere index) |
| **Vermogensontwikkeling** | Historisch verloop van netto vermogen |
| **Cashflow overzicht** | Relevante inkomsten/uitgaven voor netto vermogen — geen volledige budgettering |

---

## Buiten scope (v1)

De volgende functionaliteiten vallen bewust buiten scope voor de eerste versie:

| Buiten scope | Reden |
|---|---|
| Volledige budgettering | Te breed; geen toegevoegde waarde voor primaire use case |
| Belastingaangifte & fiscale optimalisatie | Te complex voor v1; vereist domeinspecifieke logica per situatie |
| Geautomatiseerde bankkoppelingen (Open Banking/PSD2) | Complexe integratie, privacy-gevoelig; handmatige import volstaat in v1 |
| Beleggingsadvies / aanbevelingen | Buiten scope én juridisch gevoelig |
| Multi-user / samenwerking | Solo app; geen gedeeld gebruik |

### Toekomstige uitbreidingen (niet nu, wel bewust opengehouden)

- **Belastinginzicht per asset** — wat is het werkelijk rendement ná belasting (box 3, etc.)? Het datamodel moet dit later mogelijk maken zonder refactor.
- **AI-gebaseerde inzichten & advies** — gepland voor Fase 4; niet in v1-3 bouwen.

---

## Gebruikerscontext

- Solo gebruiker, één account
- Meerdere brokers én banken
- Verhuurappartement als actieve belegging met eigen cashflow
- Primaire valuta: EUR
- Geografische context: Nederland (relevant voor belastinglogica later)
