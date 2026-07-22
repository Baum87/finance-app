import Decimal from 'decimal.js'
import type { BrokerFileParser, ParsedTransactionRow, ParseWarning, RawGrid } from '../types'

// Degiro's xlsx-transactie-export. Kolomvolgorde bevat lege "spacer"-kolommen
// en ongelabelde valuta-subkolommen (bv. naast "Lokale waarde") — daarom zoeken
// we koppen op naam i.p.v. vaste positie, robuust tegen kleine layoutwijzigingen.
const REQUIRED_HEADERS = [
  'Datum', 'Product', 'ISIN', 'Aantal', 'Koers',
  'Waarde EUR', 'Transactiekosten en/of kosten van derden EUR', 'Order ID',
] as const

function findHeaderRow(grid: RawGrid): { rowIndex: number; columns: Map<string, number> } | null {
  for (let r = 0; r < Math.min(grid.length, 5); r++) {
    const row = grid[r]
    const columns = new Map<string, number>()
    row.forEach((cell, i) => {
      if (typeof cell !== 'string' || cell.trim() === '') return
      const key = cell.trim()
      // Degiro's headerrij heeft samengevoegde cellen (bv. "Koers" spant 2 kolommen) —
      // exceljs dupliceert de kopnaam naar beide kolommen. Eerste (linker/master)
      // kolom wint, want daar staat de echte waarde; de tweede is een sub-kolom
      // (valuta-code) zonder eigen koptekst.
      if (!columns.has(key)) columns.set(key, i)
    })
    if (REQUIRED_HEADERS.every(h => columns.has(h))) return { rowIndex: r, columns }
  }
  return null
}

function toDecimalString(value: unknown, decimals: number): string | null {
  if (value === null || value === undefined || value === '') return null
  const n = typeof value === 'number' ? value : Number(String(value).replace(',', '.'))
  if (Number.isNaN(n)) return null
  return new Decimal(n).abs().toFixed(decimals)
}

/** Degiro levert "Datum" als tekst dd-mm-jjjj, niet als Excel-datumserial. */
function toIsoDate(value: unknown): string | null {
  if (value instanceof Date) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
  }
  if (typeof value !== 'string') return null
  const match = value.trim().match(/^(\d{2})-(\d{2})-(\d{4})$/)
  if (!match) return null
  const [, dd, mm, yyyy] = match
  return `${yyyy}-${mm}-${dd}`
}

export const degiroParser: BrokerFileParser = {
  id: 'degiro',
  label: 'Degiro',

  detect(grid) {
    return findHeaderRow(grid) !== null
  },

  parse(grid) {
    const header = findHeaderRow(grid)
    if (!header) throw new Error('Degiro-headerrij niet gevonden in bestand')
    const { rowIndex, columns } = header

    const col = (name: string) => columns.get(name)!
    const rows: ParsedTransactionRow[] = []
    const warnings: ParseWarning[] = []

    for (let r = rowIndex + 1; r < grid.length; r++) {
      const raw = grid[r]
      const isEmpty = raw.every(cell => cell === null || cell === undefined || cell === '')
      if (isEmpty) continue

      const rowNumber = r + 1
      const isin = String(raw[col('ISIN')] ?? '').trim().toUpperCase()
      const product = String(raw[col('Product')] ?? '').trim()
      const isoDate = toIsoDate(raw[col('Datum')])
      const quantityRaw = raw[col('Aantal')]
      const quantity = toDecimalString(quantityRaw, 8)
      const pricePerUnit = toDecimalString(raw[col('Koers')], 4)
      const amount = toDecimalString(raw[col('Waarde EUR')], 2)
      const feesTx = new Decimal(toDecimalString(raw[col('Transactiekosten en/of kosten van derden EUR')], 2) ?? '0')
      const autoFxIdx = columns.get('AutoFX Kosten')
      const feesFx = autoFxIdx !== undefined ? new Decimal(toDecimalString(raw[autoFxIdx], 2) ?? '0') : new Decimal(0)
      // Degiro's "Order ID"-kop spant een samengevoegde 2-koloms header, maar de
      // echte UUID staat in de rijen daaronder één kolom naar rechts (de kolom
      // onder de kop zelf blijft leeg). Val terug op de kop-kolom zelf mocht een
      // toekomstige export dit niet meer samenvoegen.
      const orderIdCol = col('Order ID')
      const orderId = String(raw[orderIdCol] ?? raw[orderIdCol + 1] ?? '').trim()

      if (!isin) { warnings.push({ row: rowNumber, message: 'Geen ISIN — rij overgeslagen' }); continue }
      if (!isoDate) { warnings.push({ row: rowNumber, message: 'Datum niet leesbaar — rij overgeslagen' }); continue }
      if (!quantity || Number(quantity) === 0) { warnings.push({ row: rowNumber, message: 'Geen geldig aantal — rij overgeslagen' }); continue }
      if (!pricePerUnit) { warnings.push({ row: rowNumber, message: 'Geen geldige koers — rij overgeslagen' }); continue }
      if (!amount) { warnings.push({ row: rowNumber, message: 'Geen geldige waarde EUR — rij overgeslagen' }); continue }

      const aantal = typeof quantityRaw === 'number' ? quantityRaw : Number(String(quantityRaw).replace(',', '.'))

      rows.push({
        isin,
        product,
        transactionDate: isoDate,
        transactionType: aantal >= 0 ? 'buy' : 'sell',
        quantity,
        pricePerUnit,
        amount,
        fees: feesTx.plus(feesFx).toFixed(2),
        externalRef: orderId || null,
      })
    }

    return { brokerFormat: 'degiro', rows, warnings }
  },
}
