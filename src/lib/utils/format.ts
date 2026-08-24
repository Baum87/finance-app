export const formatCurrency = (value: number) =>
  new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value)

// Voor bedragen per regel in een tabel — daar willen we de centen zien,
// i.p.v. afgerond op hele euro's zoals bij samenvattende KPI's.
export const formatCurrencyPrecise = (value: number) =>
  new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)

export const formatPercent = (value: number) =>
  new Intl.NumberFormat('nl-NL', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)

export const formatQuantity = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined || value === '') return '—'
  const n = Number(value)
  if (isNaN(n)) return '—'
  // Strip trailing zeros, max 8 decimals (crypto precision)
  return n.toLocaleString('nl-NL', { maximumFractionDigits: 8 })
}

export const formatDate = (value: string | null | undefined): string => {
  if (!value) return '—'
  const [y, m, d] = value.split('-')
  if (!y || !m || !d) return value
  return `${d}-${m}-${y}`
}

export const formatAddress = (details: {
  street?: string | null
  postalCode?: string | null
  city?: string | null
} | null | undefined): string | null => {
  if (!details) return null
  const line1 = details.street ?? ''
  const line2 = [details.postalCode, details.city].filter(Boolean).join(' ')
  const parts = [line1, line2].filter(Boolean)
  return parts.length > 0 ? parts.join(', ') : null
}
