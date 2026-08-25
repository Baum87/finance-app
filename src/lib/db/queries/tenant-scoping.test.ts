import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// ─── Vangnet tegen cross-tenant datalekken ────────────────────────────────
//
// RLS is voor het Drizzle-queryverkeer inert (de connectie loopt via een rol
// met rolbypassrls=true — zie docs/review/audit-codebase-volledig.md, K-1).
// Dat maakt de expliciete tenantId-filter in elke queryfunctie de ENIGE
// grens tussen tenants, niet een dubbele laag. Deze test is een statische,
// heuristische controle (geen AST-parser) die de twee bugpatronen afvangt
// die deze audit al aantrof:
//   H-6: een query-functie die db-tabellen leest zonder ooit een tenantId
//        te resolven (geen userId-parameter).
//   H-2: een update/delete-statement dat zelf niet op tenantId filtert en
//        ook niet voorafgegaan wordt door een verify*Access-check.
// Vals-positieven zijn waarschijnlijker dan vals-negatieven bij dit soort
// regex-heuristiek — bij twijfel de allowlist hieronder uitbreiden met een
// duidelijke reden, niet de regels afzwakken.

const QUERIES_DIR = __dirname

const EXCLUDED_FILES = new Set([
  'tenant.ts',          // definieert getOrCreateTenant zelf — het vertrouwde primitief
  'seed.ts',            // CLI-script, geen user-request-pad
  'seed-aandelen-test.ts',
])

type FnBlock = { name: string; signature: string; body: string }

function extractExportedAsyncFunctions(source: string): FnBlock[] {
  const results: FnBlock[] = []
  const fnRegex = /export async function (\w+)\s*\(([^)]*)\)[^{]*\{/g
  let match: RegExpExecArray | null
  while ((match = fnRegex.exec(source))) {
    const [full, name, signature] = match
    const bodyStart = match.index + full.length
    let depth = 1
    let i = bodyStart
    while (i < source.length && depth > 0) {
      if (source[i] === '{') depth++
      else if (source[i] === '}') depth--
      i++
    }
    results.push({ name, signature, body: source.slice(bodyStart, i - 1) })
  }
  return results
}

/** Slice vanaf een db.update(/db.delete(-match tot de volgende `await db`-statement (of einde body). */
function mutationClauses(body: string): { kind: string; index: number; clause: string }[] {
  const clauses: { kind: string; index: number; clause: string }[] = []
  const mutationRegex = /db\s*\.\s*(update|delete)\s*\(/g
  let m: RegExpExecArray | null
  while ((m = mutationRegex.exec(body))) {
    const nextStatementIdx = body.indexOf('await db', m.index + m[0].length)
    const end = nextStatementIdx === -1 ? body.length : nextStatementIdx
    clauses.push({ kind: m[1], index: m.index, clause: body.slice(m.index, end) })
  }
  return clauses
}

const queryFiles = readdirSync(QUERIES_DIR)
  .filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts') && !EXCLUDED_FILES.has(f))

describe('lib/db/queries — tenant-scoping vangnet', () => {
  for (const file of queryFiles) {
    const source = readFileSync(join(QUERIES_DIR, file), 'utf-8')
    const fns = extractExportedAsyncFunctions(source).filter(fn =>
      /\bdb\s*\.\s*(select|insert|update|delete|query|transaction)\b/.test(fn.body),
    )
    if (fns.length === 0) continue // niets hier raakt db rechtstreeks aan (delegeert naar andere, al geteste queryfuncties)

    describe(file, () => {
      for (const fn of fns) {
        it(`${fn.name} neemt userId als parameter (H-6-patroon)`, () => {
          expect(fn.signature).toMatch(/userId\s*:\s*string/)
        })

        for (const { kind, index, clause } of mutationClauses(fn.body)) {
          it(`${fn.name} — ${kind}-statement filtert op tenantId, direct of via een voorafgaande check (H-2-patroon)`, () => {
            const bodyBefore = fn.body.slice(0, index)
            const filtersInline = /tenantId/.test(clause)
            // Twee geaccepteerde patronen om vooraf te verifiëren: een losse
            // verify*Access(...)-helper, of een inline check die op tenantId
            // filtert en bij een lege match vroegtijdig stopt (throw of
            // return) — idem in effect, andere vorm; beide komen voor.
            const namedVerifyCall = /verify\w*Access\s*\(/.test(bodyBefore)
            const inlineGuard = /tenantId/.test(bodyBefore) && /\b(throw|return)\b/.test(bodyBefore)
            expect(filtersInline || namedVerifyCall || inlineGuard).toBe(true)
          })
        }
      }
    })
  }
})
