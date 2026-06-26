import Decimal from 'decimal.js'
import { createServerSupabaseClient } from '@/lib/db/supabase-server'
import { getAssetsWithValues } from '@/lib/db/queries/assets'
import { getTransactionsByAssets } from '@/lib/db/queries/transactions'
import { buildSavingsGrowthSeries } from '@/lib/finance/savings-series'
import { formatCurrency, formatPercent } from '@/lib/utils/format'
import { Topbar } from '@/components/layout/Topbar'
import { KpiCard } from '@/components/ui/KpiCard'
import { SavingsGrowthChart } from '@/components/portfolio/SavingsGrowthChart'
import { SavingsAccountTile } from '@/components/portfolio/SavingsAccountTile'

export default async function SpaarrekeningenPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user!.id

  const allAssets   = await getAssetsWithValues(userId)
  const savings     = allAssets.filter(a => a.assetType === 'savings')
  const savingsIds  = savings.map(a => a.id)

  const allTxs = savingsIds.length > 0
    ? await getTransactionsByAssets(savingsIds)
    : []

  // ── KPI berekeningen ──────────────────────────────────────────────────────

  const totaalSaldo = savings.reduce((s, a) => s.plus(a.currentValue), new Decimal(0))

  const thisYear = new Date().getFullYear()

  const stortingenDitJaar = allTxs
    .filter(t => t.transactionType === 'deposit' && new Date(t.transactionDate).getFullYear() === thisYear)
    .reduce((s, t) => s.plus(new Decimal(t.amount)), new Decimal(0))

  const opnamesDitJaar = allTxs
    .filter(t => t.transactionType === 'withdrawal' && new Date(t.transactionDate).getFullYear() === thisYear)
    .reduce((s, t) => s.plus(new Decimal(t.amount)), new Decimal(0))

  // Gewogen gemiddelde rente op basis van saldo
  let gewogenRente: Decimal | null = null
  if (totaalSaldo.gt(0)) {
    const gewogenSom = savings.reduce((s, a) => {
      const rate = a.savingsDetails?.interestRate
        ? new Decimal(a.savingsDetails.interestRate)
        : new Decimal(0)
      return s.plus(rate.mul(a.currentValue))
    }, new Decimal(0))
    gewogenRente = gewogenSom.div(totaalSaldo).div(100)
  }

  // ── Grafiekdata ───────────────────────────────────────────────────────────

  const chartData = buildSavingsGrowthSeries(allTxs)

  return (
    <>
      <Topbar />
      <main className="mx-auto max-w-[1200px] px-8 py-12 space-y-8">

        {/* Paginakop */}
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Spaarrekeningen</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {savings.length} rekening{savings.length !== 1 ? 'en' : ''} · totaal saldo
          </p>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <KpiCard
            label="Totaal saldo"
            value={formatCurrency(totaalSaldo.toNumber())}
            subtext="Alle rekeningen"
          />
          <KpiCard
            label="Storting / opname"
            value={formatCurrency(stortingenDitJaar.minus(opnamesDitJaar).toNumber())}
            subtext={opnamesDitJaar.gt(0)
              ? `${formatCurrency(stortingenDitJaar.toNumber())} in · ${formatCurrency(opnamesDitJaar.toNumber())} uit · ${thisYear}`
              : `Stortingen ${thisYear}`}
          />
          <KpiCard
            label="Gem. rente"
            value={gewogenRente ? formatPercent(gewogenRente.toNumber()) : '—'}
            subtext="Gewogen naar saldo"
          />
        </div>

        {/* Groeigrafiek */}
        <SavingsGrowthChart data={chartData} />

        {/* Rekening tegels */}
        {savings.length > 0 ? (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-foreground">Rekeningen</h2>
              <a
                href="/assets/new?type=savings&from=/portfolio/spaarrekeningen"
                className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
              >
                + Nieuwe spaarrekening
              </a>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {savings.map(a => (
                <SavingsAccountTile
                  key={a.id}
                  id={a.id}
                  name={a.name}
                  bankName={a.savingsDetails?.bankName ?? '—'}
                  accountType={a.savingsDetails?.accountType ?? 'savings'}
                  interestRate={a.savingsDetails?.interestRate ?? null}
                  balance={a.currentValue.toNumber()}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-12 text-center">
            <p className="text-sm text-muted-foreground mb-4">Nog geen spaarrekeningen toegevoegd.</p>
            <a
              href="/assets/new?type=savings&from=/portfolio/spaarrekeningen"
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
            >
              + Nieuwe spaarrekening
            </a>
          </div>
        )}


      </main>
    </>
  )
}
