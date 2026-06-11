import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import * as schema from './schema'

// Direct connection — bypasses RLS. Gebruik alleen in server actions, seeds en admin scripts.
// Voor productie op Vercel: vervang SUPABASE_DB_URL door de gepoolde URL (poort 6543).
const client = postgres(process.env.SUPABASE_DB_URL!, { prepare: false })
export const db = drizzle(client, { schema })
