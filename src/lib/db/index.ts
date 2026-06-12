import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import * as schema from './schema'

// DATABASE_URL: Supabase Transaction Pooler (poort 6543) — werkt op alle netwerken
// SUPABASE_DB_URL: directe verbinding (poort 5432) — geblokkeerd op sommige netwerken
const connectionString = process.env.DATABASE_URL ?? process.env.SUPABASE_DB_URL!

const client = postgres(connectionString, { prepare: false })
export const db = drizzle(client, { schema })
