import { createServerSupabaseClient } from '@/lib/db/supabase-server'
import { PortfolioOverview } from '@/components/portfolio/PortfolioOverview'
import { CRYPTO_CONFIG } from '@/types/portfolio'

export default async function CryptoPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  return <PortfolioOverview config={CRYPTO_CONFIG} userId={user!.id} />
}
