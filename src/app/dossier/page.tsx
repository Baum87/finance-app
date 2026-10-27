import Decimal from 'decimal.js'
import Link from 'next/link'
import { Pencil } from 'lucide-react'
import { createServerSupabaseClient } from '@/lib/db/supabase-server'
import { getDossier, getMortgagesOverview, type DossierNoteTopic } from '@/lib/db/queries/dossier'
import { getAssetsWithValues } from '@/lib/db/queries/assets'
import { getLiabilities } from '@/lib/db/queries/liabilities'
import { getRecurringItems } from '@/lib/db/queries/recurring-items'
import {
  getStockEtfEntries, getCryptoEntries, getPensionEntries, getSavingsEntries, latestPerGroup,
} from '@/lib/db/queries/simple-entries'
import { annualizeAmount, calculateNetWorth, calculateRecurringTotals } from '@/lib/finance'
import type { RecurringFrequency } from '@/lib/finance'
import { formatCurrency, formatCurrencyPrecise, formatDate, formatAddress } from '@/lib/utils/format'
import { Topbar } from '@/components/layout/Topbar'
import { DossierSection, DossierEmpty } from '@/components/dossier/DossierSection'
import { DossierItemCard } from '@/components/dossier/DossierItemCard'
import { PrintButton } from '@/components/dossier/PrintButton'
import { NOTE_TOPICS } from '@/components/dossier/dossier-fields'
import { CATEGORY_LABELS, FREQUENCY_LABELS } from '@/components/cashflow/recurring-item-labels'

const ASSET_TYPE_LABELS: Record<string, string> = {
  stock_etf:   'Aandelen & ETF',
  crypto:      'Crypto',
  savings:     'Spaarrekening',
  real_estate: 'Vastgoed',
  pension:     'Pensioen',
  vordering:   'Vordering',
}

const LIABILITY_TYPE_LABELS: Record<string, string> = {
  student_loan:  'Studieschuld',
  personal_loan: 'Persoonlijke lening',
  other:         'Overig',
}

type BalanceRow = { key: string; label: string; detail: string | null; amount: Decimal }

function NoteBlock({ topic, body }: { topic: DossierNoteTopic; body: string | undefined }) {
  return (
    <div className="bg-card border border-border rounded-3xl p-6 break-inside-avoid print:rounded-xl print:p-4">
      <p className="text-sm font-semibold text-foreground">{NOTE_TOPICS[topic].label}</p>
      {body
        ? <p className="mt-2 text-sm text-foreground whitespace-pre-line">{body}</p>
        : <div className="mt-2"><DossierEmpty /></div>}
    </div>
  )
}

function BalanceTable({ title, rows, total }: { title: string; rows: BalanceRow[]; total: Decimal }) {
  return (
    <div className="bg-card border border-border rounded-3xl overflow-hidden break-inside-avoid print:rounded-xl">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left px-6 py-3 text-muted-foreground font-medium">{title}</th>
            <th className="text-right px-6 py-3 text-muted-foreground font-medium">Bedrag</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={2} className="px-6 py-3"><DossierEmpty /></td></tr>
          ) : rows.map(r => (
            <tr key={r.key} className="border-b border-border">
              <td className="px-6 py-3">
                <p className="font-medium text-foreground">{r.label}</p>
                {r.detail && <p className="text-xs text-muted-foreground">{r.detail}</p>}
              </td>
              <td className="px-6 py-3 text-right text-foreground tabular-nums">
                {formatCurrencyPrecise(r.amount.toNumber())}
              </td>
            </tr>
          ))}
          <tr>
            <td className="px-6 py-3 font-medium text-foreground">Totaal</td>
            <td className="px-6 py-3 text-right font-semibold text-foreground tabular-nums">
              {formatCurrency(total.toNumber())}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

export default async function DossierPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user!.id
  // Alleen voor weergave (geen Bewerken-knop); schrijven wordt server-side geweigerd.
  const isViewer = user!.app_metadata?.dossier_viewer === true

  const [
    dossier, assets, mortgageRows, liabilities, recurringItemRows,
    stockEtfEntries, cryptoEntries, pensionEntries, savingsEntries,
  ] = await Promise.all([
    getDossier(userId),
    getAssetsWithValues(userId),
    getMortgagesOverview(userId),
    getLiabilities(userId),
    getRecurringItems(userId),
    getStockEtfEntries(userId),
    getCryptoEntries(userId),
    getPensionEntries(userId),
    getSavingsEntries(userId),
  ])

  // ─── Bezittingen: assets + laatste stand per broker/bank uit de invoerlijsten
  const assetRows: BalanceRow[] = assets.map(a => {
    const detail =
      a.assetType === 'real_estate' ? formatAddress(a.realEstateDetails)
      : a.assetType === 'pension' && a.pensionDetails
        ? [a.pensionDetails.provider,
           a.pensionDetails.projectedAnnualBenefit
             ? `verwachte uitkering ${formatCurrency(new Decimal(a.pensionDetails.projectedAnnualBenefit).toNumber())} per jaar`
             : null,
          ].filter(Boolean).join(' · ')
      : a.assetType === 'vordering' && a.vorderingDetails ? `Tegenpartij: ${a.vorderingDetails.counterparty}`
      : a.assetType === 'savings' ? a.savingsDetails?.bankName ?? null
      : null
    return {
      key: a.id,
      label: `${a.name} · ${ASSET_TYPE_LABELS[a.assetType] ?? a.assetType}`,
      detail: detail || null,
      amount: a.currentValue,
    }
  })

  const entryRows: BalanceRow[] = [
    ...latestPerGroup(savingsEntries, e => e.bank).map(e => ({
      key: `savings-${e.id}`, label: `${e.bank} · Spaarrekening`, detail: `stand per ${formatDate(e.entryDate)}`, amount: new Decimal(e.balance),
    })),
    ...latestPerGroup(stockEtfEntries, e => e.broker).map(e => ({
      key: `stock-${e.id}`, label: `${e.broker} · Aandelen & ETF`, detail: `stand per ${formatDate(e.entryDate)}`, amount: new Decimal(e.currentValue),
    })),
    ...latestPerGroup(cryptoEntries, e => e.broker).map(e => ({
      key: `crypto-${e.id}`, label: `${e.broker} · Crypto`, detail: `stand per ${formatDate(e.entryDate)}`, amount: new Decimal(e.currentValue),
    })),
    ...latestPerGroup(pensionEntries, e => e.broker).map(e => ({
      key: `pension-${e.id}`, label: `${e.broker} · Pensioen`, detail: `stand per ${formatDate(e.entryDate)}`, amount: new Decimal(e.currentValue),
    })),
  ]
  const possessionRows = [...assetRows, ...entryRows].filter(r => r.amount.gt(0))

  // ─── Schulden: hypotheken (per lening) + overige schulden
  const debtRows: BalanceRow[] = [
    ...mortgageRows.map(m => ({
      key: m.id,
      label: `Hypotheek ${m.lender} · ${m.assetName}`,
      detail: [
        `rente ${new Decimal(m.interestRate).toString().replace('.', ',')}%`,
        m.interestRateFixedUntil ? `rentevast tot ${formatDate(m.interestRateFixedUntil)}` : null,
        m.endDate ? `looptijd tot ${formatDate(m.endDate)}` : null,
      ].filter(Boolean).join(' · '),
      amount: m.outstandingBalance,
    })),
    ...liabilities.map(l => ({
      key: l.id,
      label: `${l.name} · ${LIABILITY_TYPE_LABELS[l.liabilityType] ?? l.liabilityType}`,
      detail: l.interestRate ? `rente ${new Decimal(l.interestRate).toString().replace('.', ',')}%` : null,
      amount: new Decimal(l.amount),
    })),
  ]

  const totalPossessions = calculateNetWorth(possessionRows.map(r => ({ value: r.amount, liability: new Decimal(0) })))
  const totalDebts = calculateNetWorth(debtRows.map(r => ({ value: r.amount, liability: new Decimal(0) })))
  const estimatedNetWorth = calculateNetWorth([{ value: totalPossessions, liability: totalDebts }])

  // ─── Inkomsten & vaste lasten
  const recurring = recurringItemRows.map(r => ({
    ...r,
    annual: annualizeAmount(new Decimal(r.amount), r.frequency as RecurringFrequency),
  }))
  const recurringTotals = calculateRecurringTotals(
    recurringItemRows.map(r => ({
      itemType:  r.itemType as 'income' | 'expense',
      amount:    r.amount,
      frequency: r.frequency as RecurringFrequency,
      isActive:  r.isActive,
      isShared:  r.isShared,
    })),
  )

  const notes = dossier.notesByTopic

  return (
    <>
      <div className="print:hidden"><Topbar isViewer={isViewer} /></div>
      <main className="mx-auto max-w-[1200px] px-8 py-12 space-y-10 print:px-0 print:py-0 print:space-y-6">

        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Dossier</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Stamdocument geldzaken: overzicht voor mezelf en voor mijn nabestaanden.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Afgedrukt/bekeken op {new Date().toLocaleDateString('nl-NL')}
              {dossier.lastUpdated && ` · dossier laatst bijgewerkt op ${dossier.lastUpdated.toLocaleDateString('nl-NL')}`}
            </p>
          </div>
          <div className="flex gap-2 print:hidden">
            <PrintButton />
            {!isViewer && <Link
              href="/dossier/bewerken"
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
            >
              <Pencil size={14} />
              Bewerken
            </Link>}
          </div>
        </div>

        <DossierSection number={1} title="Persoonlijk & juridisch">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <NoteBlock topic="family_situation" body={notes.get('family_situation')} />
            <NoteBlock topic="work_situation" body={notes.get('work_situation')} />
          </div>
          <h3 className="text-sm font-medium text-muted-foreground pt-2">Gezin</h3>
          {dossier.persons.length === 0 ? <DossierEmpty /> : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {dossier.persons.map(p => <DossierItemCard key={p.id} kind="person" item={p} />)}
            </div>
          )}
          <h3 className="text-sm font-medium text-muted-foreground pt-2">Documenten</h3>
          {dossier.documents.length === 0 ? <DossierEmpty /> : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {dossier.documents.map(d => <DossierItemCard key={d.id} kind="document" item={d} />)}
            </div>
          )}
        </DossierSection>

        <DossierSection number={2} title="Adviseurs & contacten" description="Wie te bellen, en waarvoor.">
          {dossier.contacts.length === 0 ? <DossierEmpty /> : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {dossier.contacts.map(c => <DossierItemCard key={c.id} kind="contact" item={c} />)}
            </div>
          )}
        </DossierSection>

        <DossierSection
          number={3}
          title="Vermogenspositie"
          description="Actuele standen uit de app. Waarden van beleggingen en vastgoed zijn indicatief."
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: 'Totaal bezittingen', value: totalPossessions },
              { label: 'Totaal schulden',    value: totalDebts },
              { label: 'Geschat vermogen',   value: estimatedNetWorth },
            ].map(k => (
              <div key={k.label} className="bg-card border border-border rounded-3xl p-6 print:rounded-xl print:p-4">
                <p className="text-xs text-muted-foreground">{k.label}</p>
                <p className={`mt-1 text-2xl font-semibold ${k.value.isNegative() ? 'text-terracotta' : 'text-foreground'}`}>
                  {formatCurrency(k.value.toNumber())}
                </p>
              </div>
            ))}
          </div>
          <BalanceTable title="Bezittingen" rows={possessionRows} total={totalPossessions} />
          <BalanceTable title="Schulden" rows={debtRows} total={totalDebts} />
        </DossierSection>

        <DossierSection number={4} title="Inkomsten & vaste lasten" description="Doorlopende posten uit Cashflow.">
          {recurring.length === 0 ? <DossierEmpty /> : (
            <div className="bg-card border border-border rounded-3xl overflow-hidden break-inside-avoid print:rounded-xl">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-6 py-3 text-muted-foreground font-medium">Post</th>
                    <th className="text-left px-6 py-3 text-muted-foreground font-medium">Frequentie</th>
                    <th className="text-right px-6 py-3 text-muted-foreground font-medium">Bedrag</th>
                    <th className="text-right px-6 py-3 text-muted-foreground font-medium">Per jaar</th>
                  </tr>
                </thead>
                <tbody>
                  {(['income', 'expense'] as const).flatMap(type =>
                    recurring.filter(r => r.itemType === type).map(r => (
                      <tr key={r.id} className="border-b border-border">
                        <td className="px-6 py-3">
                          <p className="font-medium text-foreground">{r.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {type === 'income' ? 'Inkomen' : 'Uitgave'} · {CATEGORY_LABELS[r.category] ?? r.category}
                          </p>
                        </td>
                        <td className="px-6 py-3 text-muted-foreground">{FREQUENCY_LABELS[r.frequency] ?? r.frequency}</td>
                        <td className="px-6 py-3 text-right tabular-nums">{formatCurrencyPrecise(new Decimal(r.amount).toNumber())}</td>
                        <td className={`px-6 py-3 text-right tabular-nums ${type === 'expense' ? 'text-terracotta' : 'text-foreground'}`}>
                          {formatCurrencyPrecise(r.annual.toNumber())}
                        </td>
                      </tr>
                    )),
                  )}
                  <tr>
                    <td colSpan={3} className="px-6 py-3 font-medium text-foreground">
                      Inkomsten {formatCurrency(recurringTotals.annualIncome.toNumber())} − lasten {formatCurrency(recurringTotals.annualExpenses.toNumber())}
                    </td>
                    <td className="px-6 py-3 text-right font-semibold tabular-nums">
                      {formatCurrency(recurringTotals.netAnnualCashflow.toNumber())}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </DossierSection>

        <DossierSection number={5} title="Verzekeringen & lijfrentes">
          {dossier.policies.length === 0 ? <DossierEmpty /> : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {dossier.policies.map(p => <DossierItemCard key={p.id} kind="policy" item={p} />)}
            </div>
          )}
        </DossierSection>

        <DossierSection number={6} title="Onderneming">
          {dossier.businesses.length === 0 ? <DossierEmpty>Geen onderneming vastgelegd.</DossierEmpty> : (
            <div className="space-y-4">
              {dossier.businesses.map(b => <DossierItemCard key={b.id} kind="business" item={b} />)}
            </div>
          )}
        </DossierSection>

        <DossierSection number={7} title="Vooruitkijken">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <NoteBlock topic="expected_changes" body={notes.get('expected_changes')} />
            <NoteBlock topic="wishes" body={notes.get('wishes')} />
            <NoteBlock topic="open_items" body={notes.get('open_items')} />
          </div>
        </DossierSection>

        <DossierSection number={8} title="Digitale nalatenschap & overige zaken">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <NoteBlock topic="digital_legacy" body={notes.get('digital_legacy')} />
            <NoteBlock topic="other_matters" body={notes.get('other_matters')} />
          </div>
        </DossierSection>

      </main>
    </>
  )
}
