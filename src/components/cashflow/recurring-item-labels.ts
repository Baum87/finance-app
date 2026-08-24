export const ITEM_TYPE_LABELS: Record<string, string> = {
  income:  'Inkomen',
  expense: 'Uitgave',
}

export const CATEGORY_LABELS: Record<string, string> = {
  salary:        'Salaris',
  insurance:     'Verzekering',
  subscription:  'Abonnement',
  mortgage:      'Hypotheek',
  municipal_tax: 'Gemeentelijke belasting',
  groceries:     'Boodschappen',
  other:         'Overig',
}

export const FREQUENCY_LABELS: Record<string, string> = {
  monthly:     'Maandelijks',
  four_weekly: 'Per 4 weken',
  quarterly:   'Per kwartaal',
  yearly:      'Jaarlijks',
}

export const CATEGORIES_BY_TYPE: Record<string, string[]> = {
  income:  ['salary', 'other'],
  expense: ['insurance', 'subscription', 'mortgage', 'municipal_tax', 'groceries', 'other'],
}
