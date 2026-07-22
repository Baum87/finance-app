import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/db/supabase-server'
import { getBrokers } from '@/lib/db/queries/brokers'
import { Topbar } from '@/components/layout/Topbar'
import { ImportTransactionsForm } from '@/components/portfolio/ImportTransactionsForm'

export default async function ImportTransactionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  const brokers = await getBrokers(user!.id)
  const broker = brokers.find(b => b.id === id)
  if (!broker) notFound()

  const backTo = `/portfolio/aandelen-etf/broker/${id}`

  return (
    <>
      <Topbar />
      <main className="mx-auto max-w-[1200px] px-8 py-12 space-y-8">
        <div>
          <nav className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/portfolio/aandelen-etf" className="hover:text-foreground transition-colors">
              Aandelen &amp; ETFs
            </Link>
            <span>›</span>
            <Link href={backTo} className="hover:text-foreground transition-colors">
              {broker.name}
            </Link>
            <span>›</span>
            <span className="text-foreground font-medium">Transacties importeren</span>
          </nav>
          <h1 className="mt-4 text-2xl font-semibold text-foreground">Transacties importeren</h1>
          <p className="mt-1 text-sm text-muted-foreground">Voor broker {broker.name}</p>
        </div>

        <ImportTransactionsForm brokerId={broker.id} backTo={backTo} />
      </main>
    </>
  )
}
