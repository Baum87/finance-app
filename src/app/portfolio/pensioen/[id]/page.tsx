import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/db/supabase-server'
import { getAssetWithCalculations } from '@/lib/db/queries/assets'
import { getTransactions } from '@/lib/db/queries/transactions'
import { formatCurrency } from '@/lib/utils/format'
import { Topbar } from '@/components/layout/Topbar'
import { KpiCard } from '@/components/ui/KpiCard'
import { ValuationForm } from '@/components/assets/ValuationForm'
import { TransactionList } from '@/components/assets/TransactionList'
import { createValuationAction } from '@/app/assets/actions'
import { DeleteAssetButton } from '@/components/portfolio/DeleteAssetButton'

const PENSION_TYPE_LABELS: Record<string, string> = {
  defined_benefit:      'Defined benefit',
  defined_contribution: 'Defined contribution',
  annuity:              'Lijfrente',
}

export default async function PensioenDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [result, txList] = await Promise.all([
    getAssetWithCalculations(user!.id, id),
    getTransactions(user!.id, id),
  ])

  if (!result || result.asset.assetType !== 'pension') notFound()

  const { asset, calculations } = result
  const { currentValue } = calculations

  const benefit = asset.pensionDetails?.projectedAnnualBenefit

  return (
    <>
      <Topbar />
      <main className="mx-auto max-w-[1200px] px-8 py-12 space-y-8">

        <div>
          <Link
            href="/portfolio/pensioen"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Pensioen
          </Link>
          <div className="mt-4 flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-foreground">{asset.name}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {asset.pensionDetails?.provider ?? '—'}
                {asset.pensionDetails?.pensionType
                  ? ` · ${PENSION_TYPE_LABELS[asset.pensionDetails.pensionType] ?? asset.pensionDetails.pensionType}`
                  : ''}
              </p>
            </div>
            <Link
              href={`/assets/${asset.id}/edit?from=/portfolio/pensioen/${asset.id}`}
              className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              Bewerken
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <KpiCard
            label="Opgebouwde waarde"
            value={currentValue.gt(0) ? formatCurrency(currentValue.toNumber()) : '—'}
            subtext="Meest recente waardering"
          />
          <KpiCard
            label="Verwachte jaaruitkering"
            value={benefit ? formatCurrency(Number(benefit)) : '—'}
            subtext="Bruto per jaar bij pensionering"
          />
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
          <ValuationForm
            assetId={asset.id}
            currency={asset.currency}
            action={createValuationAction}
            label="Pensioenwaarde bijwerken"
          />
          {asset.valuations && asset.valuations.length > 0 && (
            <div className="space-y-1 pt-4 border-t border-border">
              <p className="text-xs font-medium text-muted-foreground mb-2">Waarde-historie</p>
              {asset.valuations.map(v => (
                <div key={v.id} className="flex justify-between py-1.5">
                  <span className="text-sm text-muted-foreground">{v.valuationDate}</span>
                  <span className="text-sm font-medium text-foreground">
                    {formatCurrency(Number(v.value))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Transacties</h2>
            <Link
              href={`/assets/${asset.id}/transactions/new?from=/portfolio/pensioen/${asset.id}`}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
            >
              + Transactie
            </Link>
          </div>
          <TransactionList
            transactions={txList}
            assetId={asset.id}
            addHref={`/assets/${asset.id}/transactions/new?from=/portfolio/pensioen/${asset.id}`}
            redirectTo={`/portfolio/pensioen/${asset.id}`}
          />
        </div>

        <div className="flex justify-end pt-4">
          <DeleteAssetButton assetId={asset.id} assetName={asset.name} redirectTo="/portfolio/pensioen" />
        </div>

      </main>
    </>
  )
}
