import { Topbar } from '@/components/layout/Topbar'

export default function CashflowPage() {
  return (
    <>
      <Topbar />
      <main className="mx-auto max-w-[1200px] px-8 py-12 space-y-6">

        {/* KPI cards */}
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Passief inkomen dit jaar', value: '€10.330' },
            { label: 'Netto vermogensgroei dit jaar', value: '+€18.500' },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-[24px] border border-border bg-card p-6">
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="mt-4 text-2xl font-semibold text-foreground">{value}</p>
            </div>
          ))}
        </div>

        {/* Passief inkomen breakdown placeholder */}
        <div className="rounded-[24px] border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground mb-6">Passief inkomen breakdown</p>
          <div className="space-y-4">
            {[
              { label: 'Dividend',  pct: 35 },
              { label: 'Rente',     pct: 14 },
              { label: 'Huur netto', pct: 51 },
            ].map(({ label, pct }) => (
              <div key={label} className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground w-24 shrink-0">{label}</span>
                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-sage" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-sm font-medium text-foreground w-8 text-right">{pct}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Vermogen tijdlijn placeholder */}
        <div className="rounded-[24px] border border-border bg-card p-6 h-64 flex items-center justify-center">
          <p className="text-sm text-muted-foreground italic">Netto vermogen tijdlijn — komt in Sprint 3</p>
        </div>

      </main>
    </>
  )
}
