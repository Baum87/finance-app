'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireUser } from '@/lib/db/supabase-server'
import {
  saveDossierItem, deleteDossierItem, saveDossierNote,
  type DossierKind, type DossierInput,
} from '@/lib/db/queries/dossier'

export type ActionState = { error: string } | null

// Lege formuliervelden komen binnen als '' — opslaan als null.
const optionalText = z.string().trim().transform(v => v || null)
const requiredText = (label: string) => z.string().trim().min(1, `${label} is verplicht`)
const optionalDate = z.string().trim()
  .refine(v => v === '' || /^\d{4}-\d{2}-\d{2}$/.test(v), 'Ongeldige datum')
  .transform(v => v || null)
// Bedragen als string naar numeric(15,2) — nooit via Number/float.
const optionalMoney = z.string().trim()
  .refine(v => v === '' || /^\d+(\.\d{1,2})?$/.test(v), 'Ongeldig bedrag')
  .transform(v => v || null)
const optionalSignedMoney = z.string().trim()
  .refine(v => v === '' || /^-?\d+(\.\d{1,2})?$/.test(v), 'Ongeldig bedrag')
  .transform(v => v || null)
const optionalEmail = z.string().trim()
  .refine(v => v === '' || z.email().safeParse(v).success, 'Ongeldig e-mailadres')
  .transform(v => v || null)

const SCHEMAS = {
  person: z.object({
    name:        requiredText('Naam'),
    relation:    z.enum(['self', 'partner', 'child', 'grandchild', 'parent', 'other']),
    birthDate:   optionalDate,
    nationality: optionalText,
    notes:       optionalText,
  }),
  document: z.object({
    documentType: z.enum(['marital_agreement', 'cohabitation_agreement', 'will', 'codicil', 'living_will', 'other']),
    documentDate: optionalDate,
    notary:       optionalText,
    location:     optionalText,
    summary:      optionalText,
  }),
  contact: z.object({
    role:    z.enum(['notary', 'tax_advisor', 'accountant', 'private_banker', 'business_banker', 'insurance_advisor', 'wealth_planner', 'other']),
    company: optionalText,
    name:    optionalText,
    address: optionalText,
    phone:   optionalText,
    email:   optionalEmail,
    notes:   optionalText,
  }),
  policy: z.object({
    policyType:     z.enum(['capital', 'term_life', 'annuity', 'disability', 'funeral', 'other']),
    insurer:        requiredText('Maatschappij'),
    policyNumber:   optionalText,
    phone:          optionalText,
    contactPerson:  optionalText,
    policyholder:   optionalText,
    insured:        optionalText,
    beneficiary:    optionalText,
    startDate:      optionalDate,
    endDate:        optionalDate,
    annualPremium:  optionalMoney,
    premiumEndDate: optionalDate,
    insuredAmount:  optionalMoney,
    currentValue:   optionalMoney,
    notes:          optionalText,
  }),
  business: z.object({
    name:               requiredText('Naam'),
    legalForm:          z.enum(['sole_proprietorship', 'partnership', 'bv', 'holding_bv', 'other']),
    address:            optionalText,
    phone:              optionalText,
    activities:         optionalText,
    structure:          optionalText,
    intrinsicValue:     optionalMoney,
    netProfit:          optionalSignedMoney,
    estimatedSaleValue: optionalMoney,
    holdingLiquidity:   optionalMoney,
    agreements:         optionalText,
  }),
} satisfies { [K in DossierKind]: z.ZodType<DossierInput<K>> }

const KindSchema = z.enum(['person', 'document', 'contact', 'policy', 'business'])
const IdSchema = z.uuid('Ongeldig ID')
const NoteTopicSchema = z.enum([
  'family_situation', 'work_situation', 'expected_changes',
  'wishes', 'open_items', 'digital_legacy', 'other_matters',
])

function revalidateDossier() {
  revalidatePath('/dossier')
  revalidatePath('/dossier/bewerken')
}

/** Toevoegen (zonder `id`) of bijwerken (met `id`) van een dossier-item. */
export async function saveDossierItemAction(prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser()

  const kind = KindSchema.safeParse(formData.get('kind'))
  if (!kind.success) return { error: 'Onbekend dossier-onderdeel' }

  const rawId = formData.get('id')
  const id = rawId ? IdSchema.safeParse(rawId) : null
  if (id && !id.success) return { error: 'Ongeldig ID' }

  const schema = SCHEMAS[kind.data]
  const raw = Object.fromEntries(
    Object.keys(schema.shape).map(key => [key, String(formData.get(key) ?? '')]),
  )
  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues.map(i => i.message).join(', ') }
  }

  await saveDossierItem(user.id, kind.data, id?.data ?? null, parsed.data)
  revalidateDossier()
  return null
}

export async function deleteDossierItemAction(formData: FormData): Promise<void> {
  const user = await requireUser()

  const kind = KindSchema.safeParse(formData.get('kind'))
  const id = IdSchema.safeParse(formData.get('id'))
  if (!kind.success || !id.success) throw new Error('Ongeldig dossier-item')

  await deleteDossierItem(user.id, kind.data, id.data)
  revalidateDossier()
}

export async function saveDossierNoteAction(prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser()

  const topic = NoteTopicSchema.safeParse(formData.get('topic'))
  if (!topic.success) return { error: 'Onbekend onderwerp' }

  const body = String(formData.get('body') ?? '').trim()
  await saveDossierNote(user.id, topic.data, body)
  revalidateDossier()
  return null
}
