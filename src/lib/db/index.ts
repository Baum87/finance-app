import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import * as schema from './schema'

// DATABASE_URL: Supabase Transaction Pooler (poort 6543) — werkt op alle netwerken
// SUPABASE_DB_URL: directe verbinding (poort 5432) — geblokkeerd op sommige netwerken
const connectionString = process.env.DATABASE_URL ?? process.env.SUPABASE_DB_URL!

// HMR-veilige singleton: in dev herlaadt Next.js/Turbopack dit module bij elke
// wijziging van een bestand dat 'db' importeert. Zonder globalThis-caching opent
// dat bij elke reload een nieuwe postgres-pool zonder de vorige te sluiten, tot
// de Supabase-pooler zijn connectielimiet raakt ("max client connections reached").
const globalForDb = globalThis as unknown as { dbClient?: ReturnType<typeof postgres> }

const client = globalForDb.dbClient ?? postgres(connectionString, { prepare: false })

if (process.env.NODE_ENV !== 'production') {
  globalForDb.dbClient = client
}

export const db = drizzle(client, { schema })
