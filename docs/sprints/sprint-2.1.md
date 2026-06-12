# Sprint 2.1 — Initial project setup

**Datum:** 11 juni 2026
**Status:** Afgerond
**Commit:** `dfa6985`

## Doel

Een werkende ontwikkelomgeving neerzetten met de juiste tech stack, mappenstructuur en basisconfiguratie — zodat alle volgende sprints op een solide fundament bouwen.

---

## Wat is gebouwd

### Stack & tooling
- Next.js 16.2 met App Router + Turbopack
- TypeScript strict mode ingeschakeld
- Tailwind CSS v4 geconfigureerd (CSS-first via `@theme` in `globals.css`)
- shadcn/ui new-york geïnstalleerd (`components.json`)
- Drizzle ORM geconfigureerd (`drizzle.config.ts`)

### Componenten (shadcn/ui)
Eerste UI-componenten toegevoegd aan `src/components/ui/`:
- Button, Card, Input, Label, Select, Separator, Table

### Database
- Supabase client voor browser: `src/lib/db/supabase.ts`
- Supabase client voor server (RSC/actions): `src/lib/db/supabase-server.ts`
- Leeg Drizzle-schema als startpunt: `src/lib/db/schema.ts`

### Projectstructuur
Mappenstructuur opgezet conform architectuurprincipes:
```
src/
  app/              # routes, layouts, server actions
  components/ui/    # shadcn/ui componenten
  lib/db/           # Drizzle schema, client, queries
  lib/finance/      # rendementsberekeningen (puur TS)
  lib/utils/        # helpers
  types/            # domeintypes
```

### Types
Basis domeintypes gedefinieerd in `src/types/index.ts`:
- `AssetType`, `TransactionType`, `MortgageType`, `PensionType` enums
- `Money` type (string, want numeric uit DB)
- `DateString` alias

### Overig
- `.env.example` aangemaakt als referentie voor vereiste variabelen
- `.env.local` toegevoegd aan `.gitignore`
- `CLAUDE.md` geschreven met stack, architectuurprincipes, naamgevingsconventies en mappenstructuur

---

## Beslissingen

| Beslissing | Motivatie |
|---|---|
| App Router (geen Pages Router) | Toekomstbestendig, Server Components als default |
| Tailwind v4 CSS-first | Geen `tailwind.config.js` nodig, thema direct in CSS |
| shadcn/ui new-york | Strakker, meer witruimte dan de default variant |
| Supabase + Drizzle | Type-safe queries, RLS-beveiliging out of the box |
| `decimal.js` voor geldbedragen | Floating point is onacceptabel voor financiële data |
