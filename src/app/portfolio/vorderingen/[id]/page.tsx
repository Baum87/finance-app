import Link from 'next/link'
import { notFound } from 'next/navigation'
import Decimal from 'decimal.js'
import { createServerSupabaseClient } from '@/lib/db/supabase-server'
import { getAssetWithCalculations } from '@/lib/db/queries/assets'
import { getTransactions } from '@/lib/db/queries/transactions'
import { formatCurrency } from '@/lib/utils/format'
import { Topbar } from '@/components/layout/Topbar'
import { KpiCard } from '@/components/ui/KpiCard'
import { TransactionList } from '@/components/assets/TransactionList'
import { DeleteAssetButton } from '@/components/portfolio/DeleteAssetButton'

const LOAN_TYPE_LABELS: Record<string, string> = {
  family:   'Familielening',
  business: 'Zakelijke lening',
  other:    'Overig',
}

export default async function VorderingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [result, txList] = await Promise.all([
    getAssetWithCalculations(user!.id, id),
    getTransactions(user!.id, id),
  ])

  if (!result || result.asset.assetType !== 'vordering') notFound()

  const { asset, calculations } = result
  const { currentValue } = calculations

  const d = asset.vorderingDetails
  const totaalRente = txList
    .filter(t => t.transactionType === 'interest')
    .reduce((s, t) => s.plus(new Decimal(t.amount)), new Decimal(0))

  const rente = d?.interestRate ? parseFloat(d.interestRate) : null

  return (
    <>
      <Topbar />
      <main className="mx-auto max-w-[1200px] px-8 py-12 space-y-8">

        <div>
          <Link
            href="/portfolio/vorderingen"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Vorderingen
          </Link>
          <div className="mt-4 flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-foreground">{asset.name}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {d?.counterparty ?? '—'}
                {d?.loanType ? ` · ${LOAN_TYPE_LABELS[d.loanType] ?? d.loanType}` : ''}
              </p>
            </div>
            <Link
              href={`/assets/${asset.id}/edit?from=/portfolio/vorderingen/${asset.id}`}
              className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              Bewerken
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            label="Uitstaand bedrag"
            value={formatCurrency(currentValue.toNumber())}
            subtext="Huidig openstaand saldo"
          />
          <KpiCard
            label="Hoofdsom"
            value={d?.principalAmount ? formatCurrency(Number(d.principalAmount)) : '—'}
            subtext="Origineel geleend bedrag"
          />
          <KpiCard
            label="Rente ontvangen"
            value={formatCurrency(totaalRente.toNumber())}
            subtext="Totaal bijgeschreven"
            trend={totaalRente.gt(0) ? { value: '', positive: true } : undefined}
          />
          <KpiCard
            label="Rentepercentage"
            value={rente !== null ? `${rente}%` : '—'}
            subtext={d?.endDate ? `Einddatum: ${d.endDate}` : 'Geen einddatum'}
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Transacties</h2>
            <Link
              href={`/assets/${asset.id}/transactions/new?from=/portfolio/vorderingen/${asset.id}`}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
            >
              + Transactie
            </Link>
          </div>
          <TransactionList
            transactions={txList}
            assetId={asset.id}
            addHref={`/assets/${asset.id}/transactions/new?from=/portfolio/vorderingen/${asset.id}`}
            redirectTo={`/portfolio/vorderingen/${asset.id}`}
          />
        </div>

        <div className="flex justify-end pt-4">
          <DeleteAssetButton assetId={asset.id} assetName={asset.name} redirectTo="/portfolio/vorderingen" />
        </div>

      </main>
    </>
  )
}
