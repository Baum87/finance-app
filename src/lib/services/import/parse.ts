import ExcelJS from 'exceljs'
import type { ParseResult, RawGrid } from './types'
import { detectParser } from './brokers'

function worksheetToGrid(worksheet: ExcelJS.Worksheet): RawGrid {
  const grid: RawGrid = []
  worksheet.eachRow({ includeEmpty: true }, (row) => {
    const values: RawGrid[number] = []
    row.eachCell({ includeEmpty: true }, (cell) => {
      const v = cell.value
      if (v === null || v === undefined) values.push(null)
      else if (v instanceof Date) values.push(v)
      // Sommige exports slaan tekst op als "rich text" runs i.p.v. platte strings —
      // zelfs zonder opmaak. Zonder deze tak leest findHeaderRow() geen enkele
      // koptekst en wordt het bestandsformaat niet herkend.
      else if (typeof v === 'object' && 'richText' in v) {
        values.push((v as { richText: { text: string }[] }).richText.map(r => r.text).join(''))
      }
      else if (typeof v === 'object' && 'text' in v) values.push(String((v as { text: unknown }).text))
      else if (typeof v === 'object' && 'result' in v) values.push((v as { result: unknown }).result as string | number)
      else values.push(v as string | number)
    })
    grid.push(values)
  })
  return grid
}

/** Leest een xlsx-bestand en herkent + parset het broker-formaat. Gooit als geen parser het bestand herkent. */
export async function parseTransactionFile(buffer: Buffer): Promise<ParseResult> {
  const workbook = new ExcelJS.Workbook()
  // exceljs declares its own local `Buffer extends ArrayBuffer` shadow type that's
  // structurally incompatible with @types/node's real Buffer (no ArrayBuffer-only
  // members like resizable/detached exist on Node's Buffer). Type-level only —
  // harmless at runtime, `any` is the only way around the broken upstream typing.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await workbook.xlsx.load(buffer as any)
  const worksheet = workbook.worksheets[0]
  if (!worksheet) throw new Error('Geen werkblad gevonden in bestand')

  const grid = worksheetToGrid(worksheet)
  const parser = detectParser(grid)
  if (!parser) throw new Error('Bestandsformaat niet herkend — dit importformaat wordt nog niet ondersteund')

  return parser.parse(grid)
}
