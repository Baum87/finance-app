export const formatCurrency = (value: number) =>
  new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value)

export const formatPercent = (value: number) =>
  new Intl.NumberFormat('nl-NL', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)

export const formatQuantity = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined || value === '') return '—'
  const n = Number(value)
  if (isNaN(n)) return '—'
  // Strip trailing zeros but keep max 3 decimals
  return n.toLocaleString('nl-NL', { maximumFractionDigits: 3 })
}
