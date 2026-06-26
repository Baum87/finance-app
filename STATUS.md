# STATUS.md — Finance App

> Dit bestand is de brug tussen nadenken (Claude Desktop) en bouwen (Claude Code).
> Werk dit bij na elke sessie. Datum bovenaan aanpassen bij elke update.

**Laatst bijgewerkt:** 26 juni 2026 — opschoonronde + nav-consolidatie

---

## Waar staan we?

De app heeft drie lagen (zie `docs/project files/fiscal-layer.md`):

| Laag | Omschrijving | Status |
|---|---|---|
| **Laag 1** | Vermogen & rendement — wat heb ik, wat levert het op? | Grotendeels gebouwd |
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
- **Nog niet gereviewed** — geen Fase D-achtige multi-expert review gedaan

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

### Hoog — bugs / correctheid
- [ ] `transactions.ts` heeft uncommitted wijzigingen — review en commit of revert
- [ ] `fiscal-layer.md` heeft uncommitted wijzigingen — review en commit

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

Kies één taak uit de "Openstaande taken" hierboven en start daar een Claude Code-sessie mee.
Aanbeveling: begin met de uncommitted changes in `transactions.ts` reviewen — die hangen al open.
