# conventions.md — Personal Finance App

Laatst bijgewerkt: 11 juni 2026
Status: opgestart (Sprint 1.2). Groeit mee tijdens Fase 2–3.

Dit document beschrijft hoe we code schrijven en structureren. Bedoeld als referentie voor
elke sessie — en als brief voor Claude Code, die altijd een afgebakende taak + deze
conventies meekrijgt.

---

## 1. Taal & types

- **TypeScript overal**, `strict` mode aan. Geen `any` zonder expliciete reden + comment.
- Liever type-inference dan handmatige types waar het leesbaar blijft.
- Domeintypes (Asset, Transaction, RealEstate, …) centraal definiëren, niet dupliceren.
- Drizzle-schema is de bron van waarheid voor DB-types; types daaruit afleiden, niet
  parallel onderhouden.

---

## 2. Mappenstructuur

Indicatief; wordt definitief in Sprint 2.1.

```
src/
  app/                # Next.js App Router (routes, layouts, server actions)
  components/
    ui/               # shadcn/ui componenten (eigendom, kopieer-vriendelijk)
    <feature>/        # feature-specifieke componenten
  lib/
    finance/          # rendementsberekeningen (XIRR, TWR, netto vermogen) — puur TS
    db/               # Drizzle schema, client, queries
    utils/            # generieke helpers (incl. geld/valuta)
  types/              # gedeelde domeintypes
```

Principe: **berekeningen los van UI los van data-access.** `lib/finance` weet niets van
React of Drizzle — puur functies in/uit, testbaar tegen finance-logic.md.

---

## 3. Naamgeving

| Wat | Conventie | Voorbeeld |
|---|---|---|
| Bestanden (componenten) | PascalCase | `AssetTable.tsx` |
| Bestanden (overig) | kebab-case | `net-worth.ts` |
| Componenten | PascalCase | `PortfolioChart` |
| Variabelen/functies | camelCase | `calculateXirr` |
| Constanten | UPPER_SNAKE | `DEFAULT_BENCHMARK` |
| DB-tabellen | snake_case, meervoud | `transactions`, `real_estate` |
| DB-kolommen | snake_case | `purchase_value`, `created_at` |
| Booleans | is/has-prefix | `isRental`, `hasMortgage` |

Engels voor code en schema; Nederlands mag in UI-teksten en documentatie.

---

## 4. Component-patronen (App Router)

- **Server Components zijn de default.** Een component wordt pas een Client Component
  (`"use client"`) als het interactiviteit, browser-API's of hooks nodig heeft (charts,
  formulieren, filters).
- Houd de `"use client"`-grens zo laag mogelijk in de boom: een statische pagina met één
  interactief widget maakt alleen dat widget client-side.
- **Data fetching gebeurt in Server Components**, niet in `useEffect`.
- **Mutaties via Server Actions** (asset toevoegen, transactie invoeren), niet via losse
  API-routes in v1.
- Geen `<form>`-tags met client-side state-trucs die de RSC-grens omzeilen; volg het
  standaard Server Actions-patroon.

---

## 5. Data-access — Drizzle + Supabase

- **Schema in TypeScript** (Drizzle), migrations via Drizzle Kit. Geen handmatige
  schema-drift in de Supabase-UI; de repo is leidend.
- **Row Level Security aan** op alle tabellen, ook al is het een solo-app. Het is het juiste
  patroon en houdt de deur open voor later. RLS-policies versiebeheerd meeleveren.
- Queries gebundeld in `lib/db/`; componenten roepen query-functies aan, schrijven niet
  zelf inline queries.
- **Raw SQL alleen waar Drizzle tekortschiet** (zware aggregaties, window functions), met
  een comment waarom. Niet als default.
- Secrets/keys uitsluitend via environment variables.

---

## 6. Geld & getallen (kritisch voor deze app)

- **Geld nooit als floating point.** Bedragen opslaan en verwerken als geheeltallige centen
  (integer) óf PostgreSQL `numeric`/`decimal` — keuze vastleggen in data-model.md (Sprint
  1.3). In JS geen `0.1 + 0.2`-fouten toelaten.
- Valuta expliciet bijhouden waar relevant; primaire valuta EUR.
- **Datums in UTC opslaan** (`timestamptz`), pas bij weergave naar lokale tijd. Voor
  rendement (XIRR) zijn exacte transactiedatums leidend.
- Percentages/rendementen als duidelijke eenheid (0.07 vs 7%) — één conventie kiezen en
  consistent toepassen; documenteren in finance-logic.md.
- Afronding pas bij weergave, niet in tussenberekeningen.

---

## 7. Styling

- Tailwind v4, CSS-first config (thema via `@theme` in de globale CSS — geen
  `tailwind.config.js`).
- shadcn/ui new-york style als basis; componenten leven in `components/ui/` en zijn van ons.
- Utility-classes in de markup; herhaalde patronen pas abstraheren als ze echt herhalen.
- Dark mode meenemen vanaf het begin (komt ook terug in Sprint 5.2).

---

## 8. Errors & validatie

- Input valideren aan de rand (formulieren, server actions) — kandidaat: Zod, te bevestigen
  in Sprint 2.1.
- Finance-functies werpen bij ongeldige input een duidelijke error i.p.v. stilletjes
  `NaN`/0 teruggeven.
- Geen silent failures op geld-paden.

---

## 9. Git & commits

- Kleine, afgebakende commits per logische stap.
- Commit messages in het Engels, imperatief: `add asset CRUD`, `fix xirr edge case`.
- Branch-strategie licht (solo): `main` werkend houden; feature-branches waar nuttig.

---

## 10. Werkwijze met Claude Code

- Claude Code krijgt **altijd een afgebakende taak + relevante context** mee (deze
  conventies, betreffende docs, scope van de sprint).
- `CLAUDE.md` in de repo (Sprint 2.1) verwijst naar deze conventies zodat Code consistent
  blijft.
- Output van Code wordt teruggekoppeld in de Desktop-sessie; beslissingen landen in
  decisions.md.
