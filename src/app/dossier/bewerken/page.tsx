import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createServerSupabaseClient } from '@/lib/db/supabase-server'
import { getDossier, type Dossier, type DossierKind, type DossierNoteTopic } from '@/lib/db/queries/dossier'
import { getDossierViewers } from '@/lib/db/queries/dossier-viewers'
import { Topbar } from '@/components/layout/Topbar'
import { DossierSection } from '@/components/dossier/DossierSection'
import { DossierItemForm } from '@/components/dossier/DossierItemForm'
import { DossierNoteForm } from '@/components/dossier/DossierNoteForm'
import { DOSSIER_SECTIONS } from '@/components/dossier/dossier-fields'
import { ViewerInviteForm } from '@/components/dossier/ViewerInviteForm'
import { ConfirmDeleteButton } from '@/components/ui/ConfirmDeleteButton'
import { deleteDossierItemAction, resendDossierViewerInviteAction, revokeDossierViewerAction } from '../actions'

type Item = { id: string } & Record<string, unknown>

function ItemEditor({ kind, items }: { kind: DossierKind; items: Item[] }) {
  const section = DOSSIER_SECTIONS[kind]
  return (
    <div className="space-y-3">
      {items.map(item => (
        <details key={item.id} className="group bg-card border border-border rounded-3xl">
          <summary className="flex cursor-pointer items-center justify-between px-6 py-4 text-sm font-medium text-foreground list-none">
            {section.heading(item)}
            <span className="text-xs text-muted-foreground group-open:hidden">Wijzigen</span>
          </summary>
          <div className="px-6 pb-6 space-y-4">
            <DossierItemForm kind={kind} item={item} />
            <ConfirmDeleteButton
              action={deleteDossierItemAction}
              hiddenFields={{ kind, id: item.id }}
              confirmMessage={`"${section.heading(item)}" verwijderen uit het dossier?`}
              label="Verwijderen"
              className="text-sm text-terracotta hover:underline"
            />
          </div>
        </details>
      ))}
      <div className="bg-card border border-border rounded-3xl p-6 space-y-4">
        <p className="text-sm font-medium text-foreground">{section.addLabel}</p>
        <DossierItemForm kind={kind} />
      </div>
    </div>
  )
}

function NotesEditor({ topics, notes }: { topics: DossierNoteTopic[]; notes: Dossier['notesByTopic'] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {topics.map(topic => (
        <div key={topic} className="bg-card border border-border rounded-3xl p-6">
          <DossierNoteForm topic={topic} body={notes.get(topic)} />
        </div>
      ))}
    </div>
  )
}

function LiveDataLinks({ links }: { links: { href: string; label: string }[] }) {
  return (
    <div className="bg-card border border-border rounded-3xl p-6 text-sm text-muted-foreground">
      Dit deel komt automatisch uit de app. Beheer het via{' '}
      {links.map((l, i) => (
        <span key={l.href}>
          {i > 0 && (i === links.length - 1 ? ' en ' : ', ')}
          <Link href={l.href} className="text-foreground underline underline-offset-2">{l.label}</Link>
        </span>
      ))}
      .
    </div>
  )
}

export default async function DossierBewerkenPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [dossier, viewers] = await Promise.all([
    getDossier(user!.id),
    getDossierViewers(user!.id),
  ])

  return (
    <>
      <Topbar />
      <main className="mx-auto max-w-[1200px] px-8 py-12 space-y-10">

        <div>
          <Link href="/dossier" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft size={14} /> Terug naar dossier
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-foreground">Dossier bewerken</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Vul aan wat nabestaanden moeten weten. Alleen ingevulde velden verschijnen in het dossier.
          </p>
        </div>

        <DossierSection number={1} title="Persoonlijk & juridisch">
          <NotesEditor topics={['family_situation', 'work_situation']} notes={dossier.notesByTopic} />
          <h3 className="text-sm font-medium text-muted-foreground pt-2">Gezin</h3>
          <ItemEditor kind="person" items={dossier.persons} />
          <h3 className="text-sm font-medium text-muted-foreground pt-2">Documenten</h3>
          <ItemEditor kind="document" items={dossier.documents} />
        </DossierSection>

        <DossierSection number={2} title="Adviseurs & contacten">
          <ItemEditor kind="contact" items={dossier.contacts} />
        </DossierSection>

        <DossierSection number={3} title="Vermogenspositie">
          <LiveDataLinks links={[
            { href: '/portfolio', label: 'Portfolio' },
            { href: '/schulden',  label: 'Schulden' },
          ]} />
        </DossierSection>

        <DossierSection number={4} title="Inkomsten & vaste lasten">
          <LiveDataLinks links={[{ href: '/cashflow/vaste-lasten', label: 'Vaste lasten & inkomen' }]} />
        </DossierSection>

        <DossierSection number={5} title="Verzekeringen & lijfrentes">
          <ItemEditor kind="policy" items={dossier.policies} />
        </DossierSection>

        <DossierSection number={6} title="Onderneming">
          <ItemEditor kind="business" items={dossier.businesses} />
        </DossierSection>

        <DossierSection number={7} title="Vooruitkijken">
          <NotesEditor topics={['expected_changes', 'wishes', 'open_items']} notes={dossier.notesByTopic} />
        </DossierSection>

        <DossierSection number={8} title="Digitale nalatenschap & overige zaken">
          <NotesEditor topics={['digital_legacy', 'other_matters']} notes={dossier.notesByTopic} />
        </DossierSection>

        <DossierSection
          number={9}
          title="Toegang voor nabestaanden"
          description="Leesaccounts zien alleen het dossier. Ze kunnen niets wijzigen en komen niet bij de rest van de app."
        >
          {viewers.length > 0 && (
            <div className="bg-card border border-border rounded-3xl overflow-hidden">
              <table className="w-full text-sm">
                <tbody>
                  {viewers.map(v => (
                    <tr key={v.userId} className="border-b border-border last:border-0">
                      <td className="px-6 py-3">
                        <p className="font-medium text-foreground">{v.email}</p>
                        <p className="text-xs text-muted-foreground">Uitgenodigd op {v.createdAt.toLocaleDateString('nl-NL')}</p>
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex justify-end gap-4">
                          <form action={resendDossierViewerInviteAction}>
                            <input type="hidden" name="viewerUserId" value={v.userId} />
                            <button type="submit" className="text-sm text-muted-foreground hover:text-foreground hover:underline">
                              Opnieuw versturen
                            </button>
                          </form>
                          <ConfirmDeleteButton
                            action={revokeDossierViewerAction}
                            hiddenFields={{ viewerUserId: v.userId }}
                            confirmMessage={`Toegang van ${v.email} intrekken? Het leesaccount wordt verwijderd.`}
                            label="Intrekken"
                            className="text-sm text-terracotta hover:underline"
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="bg-card border border-border rounded-3xl p-6">
            <ViewerInviteForm />
          </div>
        </DossierSection>

      </main>
    </>
  )
}
