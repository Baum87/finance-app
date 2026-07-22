/**
 * Test-seed — Aandelen/ETF module opnieuw testen na TODO.md-afronding.
 *
 * Zet 10 fictieve posities (echte tickers, verzonnen bedragen) neer,
 * verdeeld over 2 brokers, in het account van EMAIL hieronder.
 * Live koersen via Yahoo Finance werken hierdoor gewoon.
 *
 * Vereisten: zelfde als seed.ts (.env.local ingevuld, db:push + rls.sql/trigger.sql uitgevoerd).
 * De user moet al bestaan (via /login of /wachtwoord-vergeten aangemaakt).
 *
 * Uitvoeren: npx tsx src/lib/db/queries/seed-aandelen-test.ts
 */

import { config } from 'dotenv'
config({ path: '.env.local' })
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { eq, and } from 'drizzle-orm'
import { createClient } from '@supabase/supabase-js'
import * as schema from '../schema'

const EMAIL = 'remco@byggr.nl'

// DATABASE_URL (pooler) i.p.v. SUPABASE_DB_URL — zelfde reden als src/lib/db/index.ts:
// directe verbinding is geblokkeerd op sommige netwerken.
const pgClient = postgres(process.env.DATABASE_URL ?? process.env.SUPABASE_DB_URL!, { prepare: false })
const db       = drizzle(pgClient, { schema })

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

type Position = {
  name: string
  ticker: string
  sector: string
  instrumentType: 'stock' | 'etf'
  broker: 'DEGIRO' | 'Trade Republic'
  buys: { date: string; quantity: string; pricePerUnit: string }[]
  dividend?: { date: string; amount: string }
  cost?: { date: string; amount: string; notes: string }
}

const positions: Position[] = [
  {
    name: 'ASML Holding', ticker: 'ASML.AS', sector: 'Technology', instrumentType: 'stock', broker: 'DEGIRO',
    buys: [
      { date: '2023-02-10', quantity: '8',  pricePerUnit: '620.0000' },
      { date: '2023-09-05', quantity: '4',  pricePerUnit: '580.0000' },
    ],
    dividend: { date: '2024-05-01', amount: '52.80' },
  },
  {
    name: 'Adyen', ticker: 'ADYEN.AS', sector: 'Technology', instrumentType: 'stock', broker: 'DEGIRO',
    buys: [
      { date: '2023-04-12', quantity: '3',  pricePerUnit: '1450.0000' },
      { date: '2024-01-15', quantity: '2',  pricePerUnit: '1180.0000' },
    ],
  },
  {
    name: 'Apple', ticker: 'AAPL', sector: 'Technology', instrumentType: 'stock', broker: 'DEGIRO',
    buys: [
      { date: '2022-11-20', quantity: '15', pricePerUnit: '145.0000' },
      { date: '2023-08-01', quantity: '10', pricePerUnit: '178.0000' },
    ],
    cost: { date: '2023-08-01', amount: '2.50', notes: 'Transactiekosten DEGIRO' },
  },
  {
    name: 'Vanguard FTSE All-World', ticker: 'VWRL.AS', sector: 'Diversified', instrumentType: 'etf', broker: 'DEGIRO',
    buys: [
      { date: '2022-06-01', quantity: '80', pricePerUnit: '95.0000' },
      { date: '2023-06-01', quantity: '60', pricePerUnit: '104.0000' },
      { date: '2024-06-01', quantity: '50', pricePerUnit: '112.0000' },
    ],
  },
  {
    name: 'iShares Core MSCI World', ticker: 'IWDA.AS', sector: 'Diversified', instrumentType: 'etf', broker: 'DEGIRO',
    buys: [
      { date: '2023-03-01', quantity: '40', pricePerUnit: '75.0000' },
      { date: '2024-03-01', quantity: '40', pricePerUnit: '84.0000' },
    ],
  },
  {
    name: 'Microsoft', ticker: 'MSFT', sector: 'Technology', instrumentType: 'stock', broker: 'Trade Republic',
    buys: [
      { date: '2022-09-15', quantity: '10', pricePerUnit: '250.0000' },
      { date: '2023-12-01', quantity: '5',  pricePerUnit: '340.0000' },
    ],
    dividend: { date: '2024-06-15', amount: '18.40' },
  },
  {
    name: 'Nvidia', ticker: 'NVDA', sector: 'Technology', instrumentType: 'stock', broker: 'Trade Republic',
    buys: [
      { date: '2023-01-10', quantity: '20', pricePerUnit: '18.0000' },
      { date: '2024-04-01', quantity: '10', pricePerUnit: '85.0000' },
    ],
  },
  {
    name: 'Shell', ticker: 'SHEL', sector: 'Energy', instrumentType: 'stock', broker: 'Trade Republic',
    buys: [
      { date: '2022-05-01', quantity: '30', pricePerUnit: '24.0000' },
      { date: '2023-10-01', quantity: '20', pricePerUnit: '28.5000' },
    ],
    cost: { date: '2023-10-01', amount: '1.00', notes: 'Transactiekosten Trade Republic' },
  },
  {
    name: 'Unilever', ticker: 'UNA.AS', sector: 'Consumer Staples', instrumentType: 'stock', broker: 'Trade Republic',
    buys: [
      { date: '2023-07-01', quantity: '25', pricePerUnit: '44.0000' },
    ],
    dividend: { date: '2024-08-01', amount: '21.25' },
  },
  {
    name: 'Vanguard S&P 500', ticker: 'VUSA.AS', sector: 'Diversified', instrumentType: 'etf', broker: 'Trade Republic',
    buys: [
      { date: '2023-05-01', quantity: '35', pricePerUnit: '78.0000' },
      { date: '2024-05-01', quantity: '25', pricePerUnit: '92.0000' },
    ],
  },
]

async function main() {
  console.log('🌱 Test-seed aandelen/ETF gestart...')

  const { data, error } = await supabaseAdmin.auth.admin.listUsers()
  if (error) throw new Error(`Ophalen users mislukt: ${error.message}`)
  const user = data.users.find(u => u.email === EMAIL)
  if (!user) throw new Error(`Geen user gevonden met e-mail ${EMAIL}. Account moet eerst bestaan (log één keer in).`)

  const [tenantUser] = await db
    .select()
    .from(schema.tenantUsers)
    .where(eq(schema.tenantUsers.userId, user.id))
  if (!tenantUser) throw new Error('Geen tenant gevonden voor deze user. Controleer trigger.sql.')
  const tenantId = tenantUser.tenantId
  console.log(`   Tenant: ${tenantId} (${EMAIL})`)

  // ── Brokers: hergebruiken als ze al bestaan ────────────────────────────────

  const brokerIds: Record<string, string> = {}
  for (const brokerName of ['DEGIRO', 'Trade Republic']) {
    const [existing] = await db
      .select()
      .from(schema.brokers)
      .where(and(eq(schema.brokers.tenantId, tenantId), eq(schema.brokers.name, brokerName)))
    if (existing) {
      brokerIds[brokerName] = existing.id
      console.log(`   Broker "${brokerName}" bestaat al, hergebruikt.`)
    } else {
      const [created] = await db.insert(schema.brokers).values({ tenantId, name: brokerName }).returning()
      brokerIds[brokerName] = created.id
      console.log(`   Broker "${brokerName}" aangemaakt.`)
    }
  }

  // ── Posities ────────────────────────────────────────────────────────────────

  for (const pos of positions) {
    const [asset] = await db.insert(schema.assets).values({
      tenantId,
      name:      pos.name,
      assetType: 'stock_etf',
      currency:  'EUR',
    }).returning()

    await db.insert(schema.stockEtfDetails).values({
      assetId:        asset.id,
      ticker:         pos.ticker,
      brokerId:       brokerIds[pos.broker],
      accountType:    'taxable',
      sector:         pos.sector,
      instrumentType: pos.instrumentType,
    })

    const txs: (typeof schema.transactions.$inferInsert)[] = pos.buys.map(b => ({
      assetId:         asset.id,
      transactionType: 'buy',
      quantity:        b.quantity,
      pricePerUnit:    b.pricePerUnit,
      amount:          (parseFloat(b.quantity) * parseFloat(b.pricePerUnit)).toFixed(2),
      transactionDate: b.date,
      currency:        'EUR',
    }))

    if (pos.dividend) {
      txs.push({
        assetId:         asset.id,
        transactionType: 'dividend',
        amount:          pos.dividend.amount,
        transactionDate: pos.dividend.date,
        currency:        'EUR',
      })
    }
    if (pos.cost) {
      txs.push({
        assetId:         asset.id,
        transactionType: 'cost',
        amount:          pos.cost.amount,
        transactionDate: pos.cost.date,
        currency:        'EUR',
        notes:           pos.cost.notes,
      })
    }

    await db.insert(schema.transactions).values(txs)
    console.log(`   ${pos.name} (${pos.ticker}, ${pos.broker}) aangemaakt — ${txs.length} transacties`)
  }

  await pgClient.end()
  console.log(`✅ Test-seed compleet — 10 posities over ${Object.keys(brokerIds).length} brokers.`)
}

main().catch((err) => {
  console.error('❌ Test-seed mislukt:', err)
  process.exit(1)
})
