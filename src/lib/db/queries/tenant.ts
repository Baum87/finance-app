'use server'

import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tenantUsers, tenants, users } from '@/lib/db/schema'
import { createServerSupabaseClient } from '@/lib/db/supabase-server'

/**
 * Returns the tenantId for a user.
 * If no tenant exists (e.g. trigger.sql wasn't active at signup), creates one automatically.
 */
export async function getOrCreateTenant(userId: string): Promise<string> {
  // Fast path: tenant already exists
  const existing = await db
    .select({ tenantId: tenantUsers.tenantId })
    .from(tenantUsers)
    .where(and(eq(tenantUsers.userId, userId), eq(tenantUsers.role, 'owner')))
    .limit(1)

  if (existing[0]) return existing[0].tenantId

  // Slow path: replicate what trigger.sql does
  // 1. Ensure public.users record exists (FK requirement for tenant_users)
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Niet ingelogd')

  await db
    .insert(users)
    .values({ id: userId, email: user.email ?? userId })
    .onConflictDoNothing()

  // 2. Create tenant
  const [tenant] = await db
    .insert(tenants)
    .values({ name: user.email ?? userId })
    .returning()

  // 3. Link user as owner
  await db
    .insert(tenantUsers)
    .values({ tenantId: tenant.id, userId, role: 'owner' })

  return tenant.id
}
