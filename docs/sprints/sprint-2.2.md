# Sprint 2.2 — Schema, auth en seed

**Datum:** 11 juni 2026
**Status:** Afgerond
**Commit:** `61d2593`

## Doel

Volledige database-architectuur bouwen, beveiliging inrichten en authenticatie werkend maken — zodat de app veilig data kan opslaan en de gebruiker kan inloggen.

---

## Wat is gebouwd

### Database schema (`src/lib/db/schema.ts`)
16 tabellen met Drizzle ORM:

| Tabel | Beschrijving |
|---|---|
| `tenants` | Organisatie-eenheid per gebruiker |
| `users` | Spiegel van `auth.users` |
| `tenant_users` | Koppeltabel user ↔ tenant (rol: owner/member) |
| `assets` | Alle financiële activa |
| `transactions` | Koop, verkoop, dividend, rente, huur, kosten |
| `asset_valuations` | Periodieke waardebepalingen per asset |
| `stock_etf_details` | Ticker, ISIN, broker, accounttype |
| `crypto_details` | Ticker, wallet of exchange |
| `savings_details` | Bank, rekeningtype, rente |
| `pension_details` | Aanbieder, type, verwachte uitkering |
| `real_estate_details` | Adres, type, aankoopprijs, WOZ, verhuur-flag |
| `mortgages` | Hypotheek per vastgoedobject |
| `mortgage_balances` | Periodieke openstaande schuld |
| `liabilities` | Overige schulden (studielening etc.) |
| `fx_rates` | Wisselkoersen (geen RLS — gedeeld) |
| `asset_tax_metadata` | Box 1/2/3, vrijstelling |

Alle tabellen hebben:
- UUID primaire sleutels
- `created_at` / `updated_at` timestamps met timezone
- FK-constraints met cascade delete
- CHECK-constraints op enum-achtige velden
- Indexen op veelgebruikte join-kolommen

### Beveiliging (`src/lib/db/rls.sql`)
Row Level Security op alle user-gerelateerde tabellen. Patroon:
- Users zien alleen data van hun eigen tenant
- Isolatie loopt via `tenant_users` join
- `fx_rates` heeft geen RLS (gedeelde tabel)

### Trigger (`src/lib/db/trigger.sql`)
Bij elke nieuwe `auth.users` registratie:
1. Spiegel user naar `public.users`
2. Maak nieuwe tenant aan (naam = e-mailadres als placeholder)
3. Koppel user als `owner` aan de tenant

### Authenticatie
- Login pagina: `src/app/login/page.tsx`
- Server Actions: `signIn` en `signOut` in `src/app/login/actions.ts`
- Middleware: redirect niet-ingelogde gebruikers naar `/login`

### Seed-script (`src/lib/db/seed.ts`)
Voorbeelddata voor development:
- **VWRL** — ETF bij DEGIRO, box 3, meerdere aankopen
- **Bitcoin** — crypto op Bitvavo
- **Spaarrekening** — ING, 1,5% rente
- **Verhuurappartement** — inclusief hypotheek en huurinkomsten
- **Eigen woning** — inclusief hypotheek

### NPM scripts
```
npm run db:generate   # Drizzle → SQL migratiebestanden
npm run db:push       # Schema direct naar DB pushen
npm run db:migrate    # Migraties uitvoeren
npm run db:studio     # Drizzle Studio openen
npm run db:seed       # Voorbeelddata invoegen
```

---

## Handmatig uitgevoerd in Supabase

Vanwege geblokkeerde poort 5432 (directe verbinding) is het schema niet via `db:push` uitgerold maar via `db:generate` + SQL Editor:

1. `npm run db:generate` → `drizzle/migrations/0000_sweet_blue_shield.sql`
2. SQL handmatig uitgevoerd in Supabase SQL Editor
3. `trigger.sql` uitgevoerd in SQL Editor
4. `rls.sql` uitgevoerd in SQL Editor
5. Account aangemaakt via Supabase Authentication → Users

---

## Beslissingen

| Beslissing | Motivatie |
|---|---|
| Multi-tenant schema (ook als solo app) | Architectuur kost niets extra, biedt schaalbaarheid als de app later wordt uitgebreid |
| `numeric(15,2)` voor geldbedragen | Geen floating point — kritische regel uit CLAUDE.md |
| Cross-schema FK via trigger.sql | Drizzle ondersteunt geen `auth.users` FK — handmatig opgelost |
| Seed met realistische Nederlandse data | VWRL, Bitvavo, ING, WOZ — direct bruikbaar voor testen |
