import { createServerSupabaseClient } from '@/lib/db/supabase-server'
import { PortfolioOverview } from '@/components/portfolio/PortfolioOverview'
import { STOCK_ETF_CONFIG } from '@/types/portfolio'

export default async function AandelenEtfPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  return <PortfolioOverview config={STOCK_ETF_CONFIG} userId={user!.id} />
}
