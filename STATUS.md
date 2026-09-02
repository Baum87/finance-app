# STATUS.md — Finance App

> Dit bestand is de brug tussen nadenken (Claude Desktop) en bouwen (Claude Code).
> Werk dit bij na elke sessie. Datum bovenaan aanpassen bij elke update.

**Laatst bijgewerkt:** 2 september 2026 — status gesynchroniseerd met `docs/stappenplan.md` (C1-C10 afgerond) en opgeschoonde todo's

---

## Waar staan we?

De app heeft drie lagen (zie `docs/project files/fiscal-layer.md`):

| Laag | Omschrijving | Status |
|---|---|---|
| **Laag 1** | Vermogen & rendement — wat heb ik, wat levert het op? | Grotendeels gebouwd — ⚠️ financiële correctheid deels onbevestigd (Panel 1 nog niet uitgevoerd, zie onder) |
| **Laag 2** | Fiscale impact — box 3, rendement na belasting | Ontwerp klaar, nog niet gebouwd |
| **Laag 3** | Toekomstprojectie — FIRE, scenario's | **Gestart:** vermogensdoel-projectie + "tijd tot doel" o.b.v. verwacht rendement (aandelen én vastgoed), zie `docs/stappenplan.md` en de commits van 27-28 augustus |

**Per-module detailstatus staat niet meer hier maar in [`docs/stappenplan.md`](docs/stappenplan.md)**
(Deel C, C1 t/m C10 — allemaal afgerond) — dat document werd bijgehouden terwijl dit
bestand achterliep, dus is nu de meest actuele bron voor "wat is gebouwd, per pagina".
Dit bestand blijft het overzicht op hoofdlijnen + de eerstvolgende stap.

Kort samengevat sinds de vorige STATUS-update (26 juni):
- Portfolio-overzichtspagina volwassen geworden: liquide/totaal-allocatie-toggle,
  risicobadges per assetklasse, pensioen apart getoond, data-versheid-indicator,
  netto-inleg-vs-waarde-KPI.
- Vastgoed losgekoppeld van de oude simple-entry-lijst (uitgefaseerd, zie C7) —
  volledig asset-systeem met hypotheek-aflossingsschema, WOZ-historie, herhalende
  huur/kosten-periodes.
- Cashflow: financiële-gezondheidssectie (spaarquote, buffer-dekking,
  passief-inkomen-dekkingsgraad), trendgrafiek inkomen vs. uitgaven per maand.
- Startpagina: aandachtspunt-signaal, Actief-doel-blok (spaardoel/vermogensdoel/
  FI-dekkingsgraad) met rente-op-rente-projectie, categorie-KPI's (aandelen/crypto)
  met inleg-vs-rendement-uitsplitsing.
- Transacties importeren via xlsx (Degiro) — gebouwd tot ~60%, daarna **afgeblazen**
  (een concrete gebruikersmelding "gaat nog niet helemaal goed" is nooit verder
  uitgezocht). Gearchiveerd: `docs/sprints/todo-xlsx-import-archief.md`.

---

## Rommel die opgeruimd moet worden

| Probleem | Actie | Status |
|---|---|---|
| Dubbele sprint-bestanden (`sprint-3.1.md` én `sprint-3_1.md`) | Verwijder de `_`-varianten — zijn oudere kopieën | ✅ Gedaan |
| `docs/fase-d-crypto-fixbatch.md` zweeft in docs-root | Verplaatst naar `docs/sprints/` | ✅ Gedaan |
| `docs/todo-beleggingen.md` | Gearchiveerd als `docs/sprints/todo-beleggingen-archief.md` | ✅ Gedaan |
| `src/middleware.ts` deprecated | Hernoemd naar `src/proxy.ts`, export default `proxy` | ✅ Gedaan |
| `drizzle/migrations/meta/` miste snapshots vanaf 0005 (migraties 0005 t/m 0019 zijn handmatig geschreven, nooit via `db:generate`) | Opgelost: snapshot 0020 gegenereerd tegen een lege tijdelijke migratiemap (geen voorgaande snapshot = geen hernoem-ambiguïteit = geen interactieve TTY nodig), overgenomen als accurate snapshot van de huidige `schema.ts` met `prevId` gekoppeld aan snapshot 0004. `npm run db:generate` meldt weer correct "No schema changes" — zie `docs/review/audit-codebase-volledig.md` M-1 en migratie `0020_baseline_resync.sql` | ✅ Gedaan |
| Oude routes naast nieuwe `/portfolio/` | `/vastgoed` verwijderd (content in portfolio detail), `/vermogen` naar dropdown, `Beheer` weg uit nav | ✅ Gedaan |

---

## Openstaande taken (geordend op prioriteit)

### Kritiek — financiële correctheid (blokkeerder voor vrijgave Laag 1)

> De review-analyse (`docs/review/review-financieel-expert.md`) toonde aan dat
> Laag 1 op minimaal drie punten onjuiste getallen kan tonen. Voer deze twee
> panels uit **vóórdat nieuwe features gebouwd worden**.

- [x] **Panel 4 uitvoeren** (data-integriteit) — afgerond, rapport: `docs/reviews/panel-4-data-integriteit.md`
  - 0 kritiek · 4 hoog · 5 medium · 2 laag
  - **F-4.1 🟠** — XIRR negeert `currency`/`fxRate`; `amount` altijd als EUR behandeld — valutastrategie nooit formeel besloten
  - **F-4.2 🟠** — `fx_rates` leeg; `calculatePassiveIncome` telt gemengde valuta op zonder conversie (nu latent)
  - **F-4.4 🟠** — Zod valideert bedragen niet numeriek; `"abc"` of negatief bedrag bij `buy` passeert
  - **F-4.10 🟠** — `brokers`-tabel mist RLS-policies in `rls.sql`
  - ⚠️ Kernvraag: valutastrategie (F-4.1 + F-4.2) expliciet beslissen vóór Laag 1 vrijgave
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
- [x] Vastgoed, Cashflow, Homepage: **grotendeels doorlopen** via `docs/stappenplan.md`
  (C1-C10, financieel-adviseur-perspectief per `financial-expert.md`) — dit was geen
  formele `/code-review`-pas, maar heeft wel bugs gevonden en gefixt op elk van de
  drie pagina's (zie stappenplan.md voor de details per punt)

### Middel — opruimen
- [x] Dubbele sprint-bestanden verwijderd (sprint-3_1 t/m 3_4)
- [x] Losse doc-bestanden opgeruimd (fase-d-crypto naar sprints/, todo-beleggingen gearchiveerd)
- [x] `middleware.ts` → `proxy.ts` hernoemd
- [x] Nav geconsolideerd: `/vastgoed` samengevoegd, `/vermogen` naar portfolio-dropdown, `Beheer` weg
- [x] Root-todo's opgeruimd (2 sept): `todo.md` en `todoAandelenEtf.md` waren 100% afgerond,
  gearchiveerd naar `docs/sprints/`. `todoXlsxImport.md` (feature afgeblazen) idem.

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
  sprints/          ← per-sprint logboek + archief van afgeronde/afgeblazen todo's
                       (nooit bewerken, alleen toevoegen)
  review/           ← review-instructies/prompts (bv. review-financieel-expert.md)
  reviews/          ← review-rapporten, de output van review/ (bv. panel-4-*.md)
  stappenplan.md     ← gedetailleerde per-pagina bouwstatus (Deel A/B/C) — de bron
                       van waarheid voor "wat is gebouwd", dit bestand (STATUS.md)
                       is het overzicht op hoofdlijnen
```

---

## Volgende stap

**Voer Panel 1 (financieel expert) uit** — Panel 4 is afgerond, Panel 1 nog steeds niet.
Instructie staat in `docs/review/review-financieel-expert.md` § 3.
Daarna: valutastrategie beslissen (F-4.1/F-4.2), dan pas nieuwe features of Laag 2.

Losstaand, geen blokkerende volgorde: `docs/feature-vaste-lasten-geschiedenis.md`
beschrijft een kleine, nog niet ingevulde keuze (inline uitklappen vs. eigen
detailpagina voor bedraghistorie) — kan tussendoor.
