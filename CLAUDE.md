# CLAUDE.md — Personal Finance App

Dit bestand geeft Claude Code de context die nodig is om consistent te werken.
Lees dit altijd vóórdat je iets bouwt.

## Stack
- Next.js 16.2, App Router + React Server Components, Turbopack
- TypeScript strict mode
- Tailwind CSS v4 (CSS-first, thema via `@theme` in globals.css)
- shadcn/ui new-york style (`src/components/ui/`)
- Supabase (PostgreSQL) + Drizzle ORM
- Zod voor validatie
- decimal.js voor geldbedragen

## Architectuurprincipes
- Server Components zijn de default. `"use client"` alleen als echt nodig.
- Data fetching in Server Components, niet in useEffect.
- Mutaties via Server Actions, geen losse API-routes in v1.
- Berekeningen (XIRR, TWR, netto vermogen) in `src/lib/finance/` — puur TS, geen React/Drizzle.
- Queries in `src/lib/db/` — componenten roepen query-functies aan, geen inline queries.

## Kritische regels (niet onderhandelen)
- Geld NOOIT als floating point. Gebruik decimal.js of numeric(15,2). Zie data-model.md.
- RLS aan op alle DB-tabellen. Altijd.
- Drizzle-schema (`src/lib/db/schema.ts`) is de bron van waarheid voor DB-types.
- Secrets uitsluitend via environment variables, nooit hardcoded.
- Finance-functies gooien een Error bij ongeldige input — nooit stilletjes NaN/0 teruggeven.

## Naamgeving
- Bestanden (componenten): PascalCase → `AssetTable.tsx`
- Bestanden (overig): kebab-case → `net-worth.ts`
- DB-tabellen: snake_case meervoud → `transactions`
- DB-kolommen: snake_case → `purchase_price`
- Booleans: is/has-prefix → `isActive`, `hasRental`
- Engels voor code; Nederlands mag in UI-teksten

## Mappenstructuur
```
src/
  app/              # routes, layouts, server actions
  components/
    ui/             # shadcn/ui
    <feature>/      # feature-specifieke componenten
  lib/
    finance/        # rendementsberekeningen — puur TS
    db/             # Drizzle schema, client, queries
    utils/          # helpers
  types/            # domeintypes
```

## Context
- Solo app, één gebruiker, primaire valuta EUR, geografische context Nederland
- Rendementen decimaal: 0.07 = 7% (UI doet ×100)
- Datums: `date` voor transacties (leidend voor XIRR), `timestamptz` voor audit

## Volledige context
Zie de /docs map voor:
- architecture.md — stack + motivatie
- conventions.md — volledige codestijl en patronen
- data-model.md — volledig DB-schema
- finance-logic.md — alle formules + testcases
