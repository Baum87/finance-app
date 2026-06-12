# decisions.md — Personal Finance App

Chronologisch logboek van keuzes (ADR-stijl). Nieuwste onderaan toevoegen.
Per beslissing: context, besluit, reden, alternatieven, trade-off.

Laatst bijgewerkt: 11 juni 2026

---

## D-001 — Werkwijze met Claude
**Datum:** 11 juni 2026 (Chat 1)
**Context:** Solo gebouwde finance-app, Claude als co-developer.
**Besluit:** Claude Desktop = denkpartner/schrijven/beslissen. Claude Code = uitvoerder met
afgebakende taken + context. Claude API = in de app zelf, pas vanaf Fase 4. Elke chat
eindigt met een session summary → Project Knowledge; elke chat start met een oriëntatiezin
(fase, docs, scope).
**Reden:** scheidt denkwerk van uitvoering en houdt context expliciet en herbruikbaar.

---

## D-002 — Scope v1
**Datum:** 11 juni 2026 (Chat 2, Sprint 1.1)
**Context:** Afbakenen wat de app wél en niet doet in v1.
**Besluit:** One-stop-shop voor vermogen, beleggingen en vastgoed; maandelijkse review als
gebruikspatroon. In scope: aandelen/ETF, crypto, spaar/deposito, vastgoed (eigen woning +
verhuur), pensioen; berekeningen netto vermogen, rendement/jaar, vastgoedrendement,
benchmark, vermogensontwikkeling, cashflow-overzicht. Buiten scope: volledige budgettering,
belastingaangifte, Open Banking/PSD2, beleggingsadvies, multi-user.
**Reden:** focus op de drie north-star-vragen; complexiteit en juridisch gevoelige delen
buiten v1 houden. Volledig vastgelegd in context.md.
**Opengehouden:** belastinginzicht per asset (datamodel moet het zonder refactor toelaten),
AI-inzichten (Fase 4).

---

## D-003 — Frontend: Next.js 16.2 (App Router)
**Datum:** 11 juni 2026 (Sprint 1.2)
**Besluit:** Next.js 16.2, App Router + React Server Components, Turbopack.
**Reden:** App Router is in 2026 de production-ready standaard (Pages Router → onderhoud);
RSC laat zware finance-berekeningen server-side draaien; Turbopack geeft snelle dev.
**Alternatief:** SvelteKit (lichter, maar kleiner ecosystem voor finance-libs en niet nodig
als we in React-land zitten).
**Trade-off:** RSC voegt complexiteit toe (caching, server/client-grens) — bewust
geaccepteerd; conventies in conventions.md.

---

## D-004 — Styling: Tailwind v4 + shadcn/ui
**Datum:** 11 juni 2026 (Sprint 1.2)
**Besluit:** Tailwind CSS v4 (CSS-first config) + shadcn/ui (new-york style).
**Reden:** v4 is stabiel, CSS-first, fors snellere builds; shadcn ondersteunt v4 + React 19
volledig en geeft eigenaarschap-vriendelijke componenten zonder zware dependency. Grote
tijdwinst voor een tabel-/formulier-zwaar dashboard.
**Trade-off:** shadcn-componenten onderhoud je zelf in de repo (gewenst, maar een
onderhoudspunt).

---

## D-005 — Backend/DB: Supabase (PostgreSQL), cloud
**Datum:** 11 juni 2026 (Sprint 1.2)
**Besluit:** Supabase (PostgreSQL + Auth + RLS + Storage), gehost op Supabase Cloud
(gratis tier voor v1).
**Reden:** sterk relationele data + SQL-zware analytics passen bij PostgreSQL; Supabase
bundelt auth/RLS/storage; open-source en self-hostbaar (geen lock-in op financiële data);
`pgvector` klaar voor AI in Fase 4.
**Alternatief:** Convex — afgewezen omdat het SQL inruilt voor real-time reactiviteit, en
real-time geen kernvereiste is (maandelijkse review); document-model is verkeerde richting
voor finance-analytics.
**Trade-off:** gratis tier heeft limieten; ruim voldoende voor solo v1, upgrade later
mogelijk.

---

## D-006 — ORM: Drizzle
**Datum:** 11 juni 2026 (Sprint 1.2)
**Besluit:** Drizzle ORM (schema-in-TypeScript), migrations via Drizzle Kit.
**Reden:** in 2026 de defacto-standaard voor nieuwe TypeScript + Supabase-projecten;
schema is TypeScript (geen aparte DSL/codegen-stap), volledige type-safety, SQL-niveau
controle, goede RLS-ondersteuning, licht.
**Alternatief:** Prisma — verdedigbaar vanwege "batteries-included" DX (Studio, schema-DSL),
maar de trend is Prisma→Drizzle en Drizzle past beter bij SQL-controle.
**Trade-off / grens:** voor zeer zware queries (CTE's, window functions) gebruiken we dunne
raw SQL i.p.v. de ORM, met comment. Finance-formules (XIRR/TWR) draaien sowieso in de
TS-laag, niet in SQL.

---

## D-007 — Charts: Recharts
**Datum:** 11 juni 2026 (Sprint 1.2)
**Besluit:** Recharts voor dashboard-grafieken (waardeverloop, allocatie-donut).
**Reden:** React-native, lightweight, dekt de v1-behoefte. Geen D3 nodig.

---

## D-008 — Geen aparte state-library
**Datum:** 11 juni 2026 (Sprint 1.2)
**Besluit:** React's ingebouwde state + Server Components; geen Redux/Zustand in v1.
**Reden:** app is niet state-intensief genoeg om een library te rechtvaardigen.
**Opengehouden:** Zustand als lichtste optie indien client-state later te complex wordt.

---

## D-009 — Berekeningen in de applicatielaag
**Datum:** 11 juni 2026 (Sprint 1.2)
**Besluit:** finance-berekeningen (XIRR, TWR, netto vermogen, vastgoedrendement, benchmark)
in pure TypeScript-functies (`lib/finance`), server-side aangeroepen. Supabase blijft
datastore, niet rekenmotor.
**Reden:** testbaar tegen finance-logic.md, versiebeheerbaar, niet vastgeklonken aan SQL.

---

## D-010 — Geld nooit als float
**Datum:** 11 juni 2026 (Sprint 1.2)
**Besluit:** bedragen als geheeltallige centen of PostgreSQL `numeric`/`decimal`, nooit
JavaScript floating point. Exacte representatie definitief vastleggen in data-model.md
(Sprint 1.3). Datums in UTC (`timestamptz`).
**Reden:** financiële correctheid; floating-point-fouten zijn onacceptabel op geld-paden.

---

## D-011 — Deployment: Vercel
**Datum:** 11 juni 2026 (Sprint 1.2)
**Besluit:** Next.js-app op Vercel; Supabase Cloud voor DB/auth; secrets via env vars.
**Reden:** natuurlijke fit bij Next.js (Turbopack/RSC), minimale ops voor een solo-project.
**Alternatief:** self-hosted (bijv. Coolify) — niet nodig in v1, blijft optie.

---

## D-012 — Geldrepresentatie: numeric(15,2)
**Datum:** 11 juni 2026 (Sprint 1.3)
**Besluit:** Bedragen opslaan als PostgreSQL `numeric(15,2)`. Geen integer-centen, geen float.
**Reden:** exact, geen conversie nodig, comfortabel voor grote bedragen (vastgoed, hypotheek).
**Alternatief:** integer-centen — correct maar vereist expliciete deling/vermenigvuldiging ×100
overal in de code. Onnodige complexiteit voor dit domein.

---

## D-013 — Rendement-eenheid: decimaal
**Datum:** 11 juni 2026 (Sprint 1.3)
**Besluit:** Rendementen altijd als decimaal: `0.07` = 7%. UI vermenigvuldigt ×100 voor weergave.
**Reden:** XIRR en TWR produceren decimalen; geen conversie tussen berekenen en opslaan.
Weergave is een UI-concern, niet een domein-concern.

---

## D-014 — Multi-tenant fundament
**Datum:** 11 juni 2026 (Sprint 1.3)
**Context:** De app wordt door meer dan één persoon gebruikt — elk met volledig geïsoleerde data.
**Besluit:** `tenants` en `tenant_users` tabellen toevoegen aan het schema. `tenant_id` als
extra kolom op `assets` en `liabilities`. RLS-policies isoleren op tenant-niveau.
**Gedrag nu:** elke gebruiker is zijn eigen tenant — wie inlogt ziet alleen zijn eigen data.
**Opengehouden:** gedeeld portfolio (meerdere users, één tenant) mogelijk zonder schema-refactor
door extra rijen in `tenant_users` toe te voegen.
**Alternatief:** puur op `user_id` isoleren — volstaat voor nu, maar vereist wél een refactor
als gedeelde portfolios later gewenst zijn. Niet de juiste afweging.
