import type { DossierKind, DossierNoteTopic } from '@/lib/db/queries/dossier'

// Eén bron voor labels en velden van het dossier: gebruikt door het
// invoerformulier (DossierItemForm) én de leesweergave (DossierItemCard).

export type DossierFieldType = 'text' | 'textarea' | 'date' | 'money' | 'email' | 'tel' | 'select'

export type DossierField = {
  name: string
  label: string
  type: DossierFieldType
  options?: Record<string, string>
  required?: boolean
  placeholder?: string
}

export const RELATION_LABELS: Record<string, string> = {
  self:       'Ikzelf',
  partner:    'Partner',
  child:      'Kind',
  grandchild: 'Kleinkind',
  parent:     'Ouder',
  other:      'Overig',
}

export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  marital_agreement:      'Huwelijksvoorwaarden',
  cohabitation_agreement: 'Samenlevingscontract',
  will:                   'Testament',
  codicil:                'Codicil',
  living_will:            'Levenstestament',
  other:                  'Overig document',
}

export const CONTACT_ROLE_LABELS: Record<string, string> = {
  notary:            'Notaris',
  tax_advisor:       'Belastingadviseur',
  accountant:        'Accountant',
  private_banker:    'Bankier privé',
  business_banker:   'Bankier zakelijk',
  insurance_advisor: 'Verzekeringsadviseur',
  wealth_planner:    'Vermogensplanner',
  other:             'Overig',
}

export const POLICY_TYPE_LABELS: Record<string, string> = {
  capital:    'Kapitaalverzekering',
  term_life:  'Overlijdensrisicoverzekering',
  annuity:    'Lijfrente',
  disability: 'Arbeidsongeschiktheidsverzekering',
  funeral:    'Uitvaartverzekering',
  other:      'Overige verzekering',
}

export const LEGAL_FORM_LABELS: Record<string, string> = {
  sole_proprietorship: 'Eenmanszaak',
  partnership:         'VOF / maatschap',
  bv:                  'BV',
  holding_bv:          'Holding BV',
  other:               'Overig',
}

type SectionConfig = {
  title: string
  addLabel: string
  fields: DossierField[]
  /** Kopregel van een item in de leesweergave. */
  heading: (row: Record<string, unknown>) => string
}

const str = (v: unknown) => (typeof v === 'string' && v !== '' ? v : null)

export const DOSSIER_SECTIONS: Record<DossierKind, SectionConfig> = {
  person: {
    title: 'Gezin',
    addLabel: 'Persoon toevoegen',
    fields: [
      { name: 'name',        label: 'Naam',          type: 'text', required: true },
      { name: 'relation',    label: 'Relatie',       type: 'select', options: RELATION_LABELS, required: true },
      { name: 'birthDate',   label: 'Geboortedatum', type: 'date' },
      { name: 'nationality', label: 'Nationaliteit', type: 'text', placeholder: 'bijv. Nederlandse' },
      { name: 'notes',       label: 'Opmerkingen',   type: 'textarea' },
    ],
    heading: r => `${str(r.name) ?? ''} · ${RELATION_LABELS[str(r.relation) ?? ''] ?? ''}`,
  },
  document: {
    title: 'Juridische documenten',
    addLabel: 'Document toevoegen',
    fields: [
      { name: 'documentType', label: 'Soort',              type: 'select', options: DOCUMENT_TYPE_LABELS, required: true },
      { name: 'documentDate', label: 'Datum',              type: 'date' },
      { name: 'notary',       label: 'Notaris',            type: 'text' },
      { name: 'location',     label: 'Vindplaats origineel', type: 'text', placeholder: 'bijv. kluis thuis, map "Notaris"' },
      { name: 'summary',      label: 'Korte samenvatting', type: 'textarea' },
    ],
    heading: r => DOCUMENT_TYPE_LABELS[str(r.documentType) ?? ''] ?? 'Document',
  },
  contact: {
    title: 'Adviseurs & contacten',
    addLabel: 'Contact toevoegen',
    fields: [
      { name: 'role',    label: 'Rol',          type: 'select', options: CONTACT_ROLE_LABELS, required: true },
      { name: 'company', label: 'Bedrijf',      type: 'text' },
      { name: 'name',    label: 'Naam',         type: 'text' },
      { name: 'address', label: 'Adres',        type: 'text', placeholder: 'Straat 1, 1234 AB Plaats' },
      { name: 'phone',   label: 'Telefoon',     type: 'tel' },
      { name: 'email',   label: 'E-mail',       type: 'email' },
      { name: 'notes',   label: 'Opmerkingen',  type: 'textarea' },
    ],
    heading: r => [CONTACT_ROLE_LABELS[str(r.role) ?? ''], str(r.company) ?? str(r.name)].filter(Boolean).join(' · '),
  },
  policy: {
    title: 'Verzekeringen & lijfrentes',
    addLabel: 'Polis toevoegen',
    fields: [
      { name: 'policyType',     label: 'Soort',                     type: 'select', options: POLICY_TYPE_LABELS, required: true },
      { name: 'insurer',        label: 'Maatschappij',              type: 'text', required: true },
      { name: 'policyNumber',   label: 'Polisnummer',               type: 'text' },
      { name: 'phone',          label: 'Telefoon',                  type: 'tel' },
      { name: 'contactPerson',  label: 'Contactpersoon',            type: 'text' },
      { name: 'policyholder',   label: 'Verzekeringnemer',          type: 'text' },
      { name: 'insured',        label: 'Verzekerde',                type: 'text' },
      { name: 'beneficiary',    label: 'Begunstigde',               type: 'text' },
      { name: 'startDate',      label: 'Ingangsdatum',              type: 'date' },
      { name: 'endDate',        label: 'Einddatum',                 type: 'date' },
      { name: 'annualPremium',  label: 'Premie per jaar (€)',       type: 'money' },
      { name: 'premiumEndDate', label: 'Einddatum premiebetaling',  type: 'date' },
      { name: 'insuredAmount',  label: 'Verzekerd bedrag / uitkering (€)', type: 'money' },
      { name: 'currentValue',   label: 'Huidige waarde ca. (€)',    type: 'money' },
      { name: 'notes',          label: 'Opmerkingen',               type: 'textarea' },
    ],
    heading: r => `${POLICY_TYPE_LABELS[str(r.policyType) ?? ''] ?? 'Polis'} · ${str(r.insurer) ?? ''}`,
  },
  business: {
    title: 'Onderneming',
    addLabel: 'Onderneming toevoegen',
    fields: [
      { name: 'name',               label: 'Naam',                         type: 'text', required: true },
      { name: 'legalForm',          label: 'Rechtsvorm',                   type: 'select', options: LEGAL_FORM_LABELS, required: true },
      { name: 'address',            label: 'Adres',                        type: 'text' },
      { name: 'phone',              label: 'Telefoon',                     type: 'tel' },
      { name: 'activities',         label: 'Activiteiten',                 type: 'textarea' },
      { name: 'structure',          label: 'Structuur & aandeelhouders',   type: 'textarea', placeholder: 'bijv. DGA 100% → Holding BV 100% → Werkmaatschappij BV' },
      { name: 'intrinsicValue',     label: 'Intrinsieke waarde (€)',       type: 'money' },
      { name: 'netProfit',          label: 'Netto winst (€)',              type: 'money' },
      { name: 'estimatedSaleValue', label: 'Geschatte verkoopwaarde (€)',  type: 'money' },
      { name: 'holdingLiquidity',   label: 'Liquide middelen in holding (€)', type: 'money' },
      { name: 'agreements',         label: 'Afspraken met compagnons/aandeelhouders', type: 'textarea' },
    ],
    heading: r => `${str(r.name) ?? ''} · ${LEGAL_FORM_LABELS[str(r.legalForm) ?? ''] ?? ''}`,
  },
}

export const NOTE_TOPICS: Record<DossierNoteTopic, { label: string; hint: string }> = {
  family_situation: { label: 'Familiesituatie',          hint: 'Korte schets van de familiesituatie.' },
  work_situation:   { label: 'Werksituatie',             hint: 'Werkgever, functie, overige (neven)functies.' },
  expected_changes: { label: 'Voorzienbare wijzigingen', hint: 'Familie, uitgaven op termijn, vermogen/inkomen, onderneming, schenkingen aan kinderen, emigratie.' },
  wishes:           { label: 'Wensen & doelstellingen',  hint: 'Wat wil je bereiken, en wat wil je dat er gebeurt?' },
  open_items:       { label: 'Openstaande punten',       hint: 'Wat moet nog geregeld of uitgezocht worden?' },
  digital_legacy:   { label: 'Digitale nalatenschap',    hint: 'Alleen de vindplaats: bijv. "Wachtwoorden in 1Password, noodkit in de kluis". Nooit wachtwoorden of pincodes hier invullen.' },
  other_matters:    { label: 'Overige zaken',            hint: 'Alles wat nabestaanden verder moeten weten.' },
}
