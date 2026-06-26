# STATUS.md — Finance App

> Dit bestand is de brug tussen nadenken (Claude Desktop) en bouwen (Claude Code).
> Werk dit bij na elke sessie. Datum bovenaan aanpassen bij elke update.

**Laatst bijgewerkt:** 26 juni 2026 — financiële correctheidsrisico's als prio toegevoegd na review-analyse

---

## Waar staan we?

De app heeft drie lagen (zie `docs/project files/fiscal-layer.md`):

| Laag | Omschrijving | Status |
|---|---|---|
| **Laag 1** | Vermogen & rendement — wat heb ik, wat levert het op? | Grotendeels gebouwd — ⚠️ financiële correctheid onbevestigd |
| **Laag 2** | Fiscale impact — box 3, rendement na belasting | Ontwerp klaar, nog niet gebouwd |
| **Laag 3** | Toekomstprojectie — FIRE, scenario's | Niet gestart |

---

## Wat is af (per module)

### Aandelen & ETF — `/portfolio/aandelen-etf/`
- Drie niveaus: overzicht → broker → positie
- Live koersen via Yahoo Finance (EUR-omrekening)
- XIRR per positie, netto inleg (buys − sells), W/V
- Allocatiedonut per sector + type
- Benchmark (URTH TWR) op vermogenspagina
- Broker als entiteit met FK
- **Openstaand:** `TransactionForm` voor dividenden/kosten/splits is ruw — geen auto-berekening, valuta-UX niet af

### Crypto — `/portfolio/crypto/`
- Overzicht + detailpagina per wallet/asset
- EUR-symbool, ticker-normalisatie (BTC → BTC-EUR), netDeposit met fees
- Silent fallback bij koersfouten → nu expliciete `priceStatus`
- **Openstaand:** portfolio-XIRR op overzichtspagina (backlog)

### Spaarrekeningen — `/portfolio/spaarrekeningen/`
- Pagina bestaat, basis werkt
- ✅ Gereviewed — typo's, `formatPercent`, Zod positief-getal validatie, `<Legend>` verwijderd

### Vastgoed — `/portfolio/vastgoed/`
- Pagina bestaat
- **Nog niet gereviewed**

### Pensioen — `/portfolio/pensioen/`
- Pagina bestaat
- **Nog niet gereviewed**

### Vorderingen — `/portfolio/vorderingen/`
- Pagina bestaat
- **Nog niet gereviewed**

### Schulden — `/schulden/`
- Pagina bestaat
- **Nog niet gereviewed**

### Cashflow — `/cashflow/`
- Passief inkomen YTD, netto vermogensgroei YTD
- PassiveIncomeBreakdown component
- **Nog niet gereviewed**

### Homepage — `/`
- Netto vermogen + inzichtkaart (grootste allocatiecategorie + groei 30d)
- **Nog niet gereviewed**

---

## Rommel die opgeruimd moet worden

| Probleem | Actie | Status |
|---|---|---|
| Dubbele sprint-bestanden (`sprint-3.1.md` én `sprint-3_1.md`) | Verwijder de `_`-varianten — zijn oudere kopieën | ✅ Gedaan |
| `docs/fase-d-crypto-fixbatch.md` zweeft in docs-root | Verplaatst naar `docs/sprints/` | ✅ Gedaan |
| `docs/todo-beleggingen.md` | Gearchiveerd als `docs/sprints/todo-beleggingen-archief.md` | ✅ Gedaan |
| `src/middleware.ts` deprecated | Hernoemd naar `src/proxy.ts`, export default `proxy` | ✅ Gedaan |
| Oude routes naast nieuwe `/portfolio/` | `/vastgoed` verwijderd (content in portfolio detail), `/vermogen` naar dropdown, `Beheer` weg uit nav | ✅ Gedaan |

---

## Openstaande taken (geordend op prioriteit)

### Kritiek — financiële correctheid (blokkeerder voor vrijgave Laag 1)

> De review-analyse (`docs/review/review-financieel-expert.md`) toonde aan dat
> Laag 1 op minimaal drie punten onjuiste getallen kan tonen. Voer deze twee
> panels uit **vóórdat nieuwe features gebouwd worden**.

- [ ] **Panel 4 uitvoeren** (data-integriteit) — start hiermee
  - R9: `fx_rates` bestaat in schema maar wordt nergens gevuld of gebruikt — gedrag bij non-EUR assets onbekend
  - Decimal precision: postgres-driver retourneert strings — worden die overal correct als `decimal.js` ingelezen?
  - Tijdzone-gedrag in YTD-berekeningen onbevestigd
  - Zie `docs/review/review-financieel-expert.md` § 6 → output: `docs/reviews/panel-4-data-integriteit.md`
- [ ] **Panel 1 uitvoeren** (financieel expert) — na Panel 4
  - R1: URTH benchmark noteert in USD, portfolio in EUR — outperformance bevat onzichtbaar valuta-effect
  - R2: Vastgoed-XIRR mengt methodologieën (noch cash-on-cash, noch unlevered IRR) — getal klopt niet
  - R3: YTD-XIRR toont geannualiseerde waarden over korte periode — +3% YTD wordt zichtbaar als ~+14%
  - Zie `docs/review/review-financieel-expert.md` § 3 → output: `docs/reviews/panel-1-financieel.md`

### Hoog — bugs / correctheid
- [x] `transactions.ts` — `getOrCreateTenant` vervangen door lokale `getTenantId` (geen side-effect in leespad)
- [x] `fiscal-layer.md` — crypto-backlog voor Fase E gedocumenteerd en gecommit

### Middel — reviews nog te doen
- [x] Spaarrekeningen: review gedaan — typo's, formatPercent, Zod validatie, Legend fix
- [ ] Vastgoed: review (huurrendement-logica in nieuw detail-page)
- [ ] Cashflow: review
- [ ] Homepage: review op correctheid KPI's

### Middel — opruimen
- [x] Dubbele sprint-bestanden verwijderd (sprint-3_1 t/m 3_4)
- [x] Losse doc-bestanden opgeruimd (fase-d-crypto naar sprints/, todo-beleggingen gearchiveerd)
- [x] `middleware.ts` → `proxy.ts` hernoemd
- [x] Nav geconsolideerd: `/vastgoed` samengevoegd, `/vermogen` naar portfolio-dropdown, `Beheer` weg

### Laag — nieuwe features
- [ ] TransactionForm verbeteren (dividend, kosten, splits — valuta UX)
- [ ] Fase E: fiscale laag bouwen (ontwerp staat in `fiscal-layer.md`)
- [ ] Portfolio-XIRR op crypto-overzicht

---

## Werkwijze (hoe we samenwerken)

### Claude Desktop → Claude Code handoff
1. **Nadenken / plannen** in Claude Desktop: beschrijf wat je wil en waarom
2. **Output van Desktop:** een taakbeschrijving als tekst, max één scherm
3. **Plak die beschrijving** als eerste bericht in Claude Code
4. **Claude Code bouwt** op basis van de beschrijving + deze STATUS.md + CLAUDE.md
5. **Na bouwen:** `/code-review` uitvoeren voor kwaliteitscontrole
6. **Update STATUS.md** — zet de taak op ✅ of voeg nieuwe bevindingen toe

### Geen agents die je handmatig overschrijft
- Claude Code heeft CLAUDE.md als instructieset — dat is genoeg
- Aparte "review-agents" werken via `/code-review` in Claude Code zelf
- Claude Desktop is voor strategie, Claude Code voor uitvoering

### Per taak: wat doe ik waar?
| Vraag | Gebruik |
|---|---|
| "Wat bouwen we als volgende?" | Claude Desktop |
| "Hoe moet dit ontworpen worden?" | Claude Desktop |
| "Bouw dit" | Claude Code |
| "Klopt deze code?" | Claude Code → `/code-review` |
| "Is dit financieel juist?" | Claude Desktop (met `docs/project files/finance-logic.md` erbij) |

---

## Docs-structuur (wat staat waar)

```
docs/
  project files/    ← stabiele architectuur & beslissingen (niet vaak aan te passen)
    architecture.md     stack-keuzes en waarom
    context.md          doel, scope, gebruikerscontext
    conventions.md      coderingsafspraken
    data-model.md       schema-overzicht
    decisions.md        ADR (architecture decision records)
    finance-logic.md    XIRR, TWR, formules — bron van waarheid
    fiscal-layer.md     Fase E ontwerp (box 3)
    frontend.md         designsysteem
    stack-overzicht.md  samenvatting tech stack
  sprints/          ← per-sprint logboek (nooit bewerken, alleen toevoegen)
  review/           ← review-rapporten
```

---

## Volgende stap

**Voer Panel 4 (data-integriteit) uit** — dit is de huidige blokkeerder.
Instructie staat in `docs/review/review-financieel-expert.md` § 6.
Volgorde: Panel 4 → Panel 1 → daarna pas nieuwe features of Laag 2 starten.
