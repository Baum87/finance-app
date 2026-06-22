# /new-migration — Nieuwe Drizzle-migratie aanmaken

Argumenten: $MIGRATION_DESCRIPTION (bijv. `add-goal-tracking`)

Stappen:
1. Pas `src/lib/db/schema.ts` aan met de nieuwe tabel of kolom
2. Voer uit: `npm run db:generate`
3. Controleer het gegenereerde migratiebestand in `drizzle/migrations/`
4. Als de migratie RLS-policies vereist:
   - Voeg de policies toe aan `src/lib/db/rls.sql`
   - Documenteer welke tabel en welk patroon
5. Voer uit in Supabase SQL Editor: het gegenereerde migratie-SQL + eventuele RLS-toevoeging
6. Verifieer met `npm run db:studio` of de tabel correct aangemaakt is
7. Update `docs/data-model.md` met de nieuwe tabel/kolom
