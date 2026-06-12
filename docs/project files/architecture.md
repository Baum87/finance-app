# architecture.md — Personal Finance App

Laatst bijgewerkt: 11 juni 2026
Status: stack definitief vastgesteld (Sprint 1.2)

---

## Overzicht stack

| Laag | Keuze | Versie/variant |
|---|---|---|
| Taal | TypeScript | strict mode, overal |
| Framework | Next.js | 16.2, App Router + RSC, Turbopack |
| Styling | Tailwind CSS | v4 (CSS-first config) |
| Componenten | shadcn/ui | new-york style |
| Charts | Recharts | — |
| Database | Supabase (PostgreSQL) | cloud / hosted |
| Auth | Supabase Auth | — |
| ORM | Drizzle | schema-in-TypeScript |
| Hosting DB | Supabase Cloud | gratis tier (v1) |
| Deployment | Vercel | — |
| State | React (ingebouwd) | geen aparte library in v1 |

Primaire valuta: **EUR**. Geografische context: **Nederland**.

---

## Architectuur in het kort

De app is een Next.js-applicatie waarin de **App Router** de scheiding bepaalt tussen
server- en client-werk:

- **React Server Components** halen data op en draaien de zware logica (berekeningen,
  aggregaties) server-side. Hier praat de app via Drizzle met Supabase.
- **Client Components** verzorgen interactiviteit: formulieren, charts, filters. Zo min
  mogelijk JS naar de client.
- **Server Actions** handelen mutaties af (asset toevoegen, transactie invoeren) zonder
  losse API-routes.

```
Browser (Client Components: charts, formulieren)
   │  ▲
   │  │  Server Actions (mutaties)
   ▼  │
Next.js Server (RSC: data fetching + finance-berekeningen in TS)
   │  ▲
   │  │  Drizzle (type-safe queries) + soms raw SQL
   ▼  │
Supabase / PostgreSQL (data, RLS, auth)
```

---

## Keuze per laag — met reden en trade-offs

### Framework — Next.js 16.2 (App Router)
**Waarom:** de App Router is in 2026 de production-ready standaard voor nieuwe projecten;
de Pages Router gaat in onderhoudsmodus. RSC laat ons de zware finance-berekeningen
server-side draaien en alleen het resultaat naar de client sturen — relevant voor een
data-zwaar dashboard. Turbopack (default sinds 16) geeft snelle dev-iteratie.

**Trade-off:** RSC voegt architecturale complexiteit toe. Caching-gedrag en de
server/client-grens vragen discipline. Voor een solo-project goed te managen, maar het is
een bewuste keuze — geen gratis lunch. Conventies hiervoor staan in conventions.md.

### Styling — Tailwind v4 + shadcn/ui
**Waarom:** Tailwind v4 gebruikt een CSS-first configuratie (geen `tailwind.config.js`
meer; thema via `@theme` in CSS) en is fors sneller in builds. shadcn/ui ondersteunt v4 +
React 19 volledig en levert direct bruikbare, eigenaarschap-vriendelijke componenten
(tabellen, dialogen, cards) — je kopieert de code, je bezit hem, geen zware dependency.
Voor een dashboard met veel tabellen en formulieren een grote tijdwinst.

**Trade-off:** shadcn-componenten leven in je eigen repo; updates moet je zelf bijhouden.
Dat is precies de bedoeling (controle), maar wel een onderhoudspunt.

### Database & auth — Supabase (PostgreSQL, cloud)
**Waarom:** de data is sterk relationeel (assets, transacties, vastgoed met eigen logica)
en de analytics zijn SQL-zwaar (netto vermogen over tijd, rendement per asset, benchmark).
PostgreSQL geeft volledige SQL-kracht met joins, transacties en foreign keys. Supabase
bundelt daar auth, storage en Row Level Security omheen. Open-source en self-hostbaar →
geen vendor lock-in op je eigen financiële data. `pgvector` zit in de doos voor de
AI-inzichten van Fase 4, zonder aparte vector-DB.

**Waarom niet Convex:** Convex ruilt SQL in voor real-time reactiviteit. Real-time is voor
ons géén kernvereiste (maandelijkse review), en het document-model zonder SQL is de
verkeerde kant op voor finance-analytics.

**Hosting:** cloud / gratis tier volstaat ruim voor v1 (solo, één account). Self-hosten
blijft als optie open dankzij de open-source basis.

### ORM — Drizzle
**Waarom:** in 2026 de defacto-standaard voor nieuwe TypeScript + Supabase-projecten.
Schema is gewoon TypeScript (geen aparte DSL, geen code-generatiestap), volledige
type-safety, SQL-niveau controle, en goede RLS-ondersteuning. Licht en edge-vriendelijk.

**Trade-off / grens:** voor zeer zware analytics-queries (CTE's, window functions) is een
ORM niet altijd het juiste gereedschap. Lijn: Drizzle voor CRUD en de meeste queries, en
waar nodig dunne raw SQL voor een specifieke zware berekening. De finance-berekeningen zelf
(XIRR/TWR) doen we niet in SQL — zie hieronder.

### Charts — Recharts
**Waarom:** React-native, lightweight, dekt waardeverloop-lijn en allocatie-donut prima.
Geen D3 nodig in v1.

### State — geen aparte library
**Waarom:** React's ingebouwde state + Server Components zijn voldoende voor deze app.
Geen Redux/Zustand in v1. Als client-state later toch te complex wordt: Zustand als
lichtste optie.

---

## Waar rekenen we? (belangrijk)

De **finance-berekeningen draaien in de TypeScript-applicatielaag**, niet in de database:

- Rendement (XIRR, TWR), netto vermogen, vastgoedrendement, benchmark-vergelijking →
  TypeScript-functies, server-side aangeroepen vanuit RSC.
- Supabase/PostgreSQL is de **datastore**, niet de rekenmotor.
- Reden: deze logica is testbaar (zie finance-logic.md, Sprint 1.3), versiebeheerbaar, en
  niet vastgeklonken aan SQL. Raw SQL gebruiken we alleen voor aggregaties/ophalen, niet
  voor de rendementsformules zelf.

**Geld nooit als float.** Bedragen worden als geheeltallige centen of als PostgreSQL
`numeric`/`decimal` opgeslagen en verwerkt — nooit als JavaScript floating point. Detail
staat in conventions.md.

---

## Deployment & omgeving

- **Vercel** voor de Next.js-app (natuurlijke fit, Turbopack/RSC-vriendelijk).
- **Supabase Cloud** voor database + auth.
- Secrets/keys via environment variables (Vercel + lokale `.env`, nooit in de repo).
- Lokale dev: Next.js dev server + Supabase (cloud-project of lokale Supabase CLI; te
  bepalen in Sprint 2.1).

---

## Toekomstvastheid (bewust opengehouden)

- **Belastinginzicht per asset** (box 3, rendement ná belasting): het datamodel moet dit
  later mogelijk maken zonder refactor — zie context.md en data-model.md (Sprint 1.3).
- **AI-inzichten (Fase 4):** Claude API in de app + `pgvector` in Supabase staan klaar;
  niet bouwen in v1–v3.
- **Self-hosting / migratie:** open-source basis (PostgreSQL, Supabase, Drizzle) houdt
  exit-opties open.
