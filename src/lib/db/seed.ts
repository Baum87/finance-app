/**
 * Seed script — Sprint 2.2
 * Aanmaken van een testuser met volledige testdata conform finance-logic.md testcases.
 *
 * Vereisten:
 *   - .env.local is ingevuld (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DB_URL)
 *   - npm run db:push is uitgevoerd (schema staat in Supabase)
 *   - trigger.sql en rls.sql zijn uitgevoerd in Supabase SQL Editor
 *
 * Uitvoeren: npm run db:seed
 */

import 'dotenv/config'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { eq } from 'drizzle-orm'
import { createClient } from '@supabase/supabase-js'
import * as schema from './schema'

const TEST_EMAIL    = 'test@finance.local'
const TEST_PASSWORD = 'Test1234!'

const pgClient = postgres(process.env.SUPABASE_DB_URL!, { prepare: false })
const db       = drizzle(pgClient, { schema })

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function seed() {
  console.log('🌱 Seed gestart...')

  // ── 1. Auth-user aanmaken ─────────────────────────────────────────────────
  // De trigger (trigger.sql) maakt automatisch tenant + users + tenant_users aan.

  const existing = await supabaseAdmin.auth.admin.listUsers()
  const existingUser = existing.data.users.find(u => u.email === TEST_EMAIL)

  let userId: string

  if (existingUser) {
    console.log('   Testuser bestaat al, wordt hergebruikt.')
    userId = existingUser.id
  } else {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email:          TEST_EMAIL,
      password:       TEST_PASSWORD,
      email_confirm:  true,
    })
    if (error || !data.user) throw new Error(`Aanmaken user mislukt: ${error?.message}`)
    userId = data.user.id
    console.log(`   Auth-user aangemaakt: ${TEST_EMAIL}`)
  }

  // ── 2. Tenant ophalen (aangemaakt door trigger) ───────────────────────────

  const [tenantUser] = await db
    .select()
    .from(schema.tenantUsers)
    .where(eq(schema.tenantUsers.userId, userId))

  if (!tenantUser) throw new Error('Trigger heeft geen tenant aangemaakt. Controleer trigger.sql.')
  const tenantId = tenantUser.tenantId
  console.log(`   Tenant: ${tenantId}`)

  // ── 3. VWRL (stock_etf) ───────────────────────────────────────────────────

  const [vwrl] = await db.insert(schema.assets).values({
    tenantId,
    name:      'VWRL — Vanguard FTSE All-World',
    assetType: 'stock_etf',
    currency:  'EUR',
  }).returning()

  await db.insert(schema.stockEtfDetails).values({
    assetId:     vwrl.id,
    ticker:      'VWRL',
    isin:        'IE00B3RBWM25',
    accountType: 'taxable',
  })

  await db.insert(schema.transactions).values([
    {
      assetId:         vwrl.id,
      transactionType: 'buy',
      amount:          '10000.00',
      transactionDate: '2022-01-01',
      currency:        'EUR',
    },
    {
      assetId:         vwrl.id,
      transactionType: 'buy',
      amount:          '5000.00',
      transactionDate: '2022-06-01',
      currency:        'EUR',
    },
  ])

  console.log('   VWRL aangemaakt + 2 transacties')

  // ── 4. BTC (crypto) ───────────────────────────────────────────────────────

  const [btc] = await db.insert(schema.assets).values({
    tenantId,
    name:      'Bitcoin',
    assetType: 'crypto',
    currency:  'EUR',
  }).returning()

  await db.insert(schema.cryptoDetails).values({
    assetId:          btc.id,
    ticker:           'BTC',
    walletOrExchange: 'Bitvavo',
  })

  await db.insert(schema.transactions).values({
    assetId:         btc.id,
    transactionType: 'buy',
    amount:          '14000.00',
    transactionDate: '2023-01-01',
    currency:        'EUR',
  })

  console.log('   BTC aangemaakt + 1 transactie')

  // ── 5. Spaarrekening ING ──────────────────────────────────────────────────

  const [spaar] = await db.insert(schema.assets).values({
    tenantId,
    name:      'Spaarrekening ING',
    assetType: 'savings',
    currency:  'EUR',
  }).returning()

  await db.insert(schema.savingsDetails).values({
    assetId:      spaar.id,
    bankName:     'ING',
    accountType:  'savings',
    interestRate: '0.0250',
  })

  await db.insert(schema.assetValuations).values({
    assetId:       spaar.id,
    valuationDate: '2024-11-30',
    value:         '15340.00',
    currency:      'EUR',
  })

  console.log('   Spaarrekening ING aangemaakt + valuation')

  // ── 6. Verhuurappartement ─────────────────────────────────────────────────

  const [verhuur] = await db.insert(schema.assets).values({
    tenantId,
    name:      'Verhuurappartement',
    assetType: 'real_estate',
    currency:  'EUR',
  }).returning()

  await db.insert(schema.realEstateDetails).values({
    assetId:       verhuur.id,
    address:       'Voorbeeldstraat 1, Amsterdam',
    propertyType:  'rental',
    purchasePrice: '280000.00',
    purchaseCosts: '8400.00',
    purchaseDate:  '2020-01-15',
    wozValue:      '320000.00',
  })

  // Hypotheek verhuurappartement
  const [hypotheekVerhuur] = await db.insert(schema.mortgages).values({
    assetId:        verhuur.id,
    lender:         'Rabobank',
    originalAmount: '224000.00',
    interestRate:   '0.0185',
    startDate:      '2020-01-15',
    endDate:        '2050-01-15',
    mortgageType:   'annuity',
  }).returning()

  await db.insert(schema.mortgageBalances).values({
    mortgageId:         hypotheekVerhuur.id,
    balanceDate:        '2024-12-31',
    outstandingBalance: '180000.00',
  })

  // Huurinkomsten 2020–2024 (conform finance-logic.md testcase)
  const rentalTransactions = [
    // 2020 (10.5 maanden)
    { date: '2020-02-01', amount: '1100.00', type: 'rental_income' as const },
    { date: '2020-03-01', amount: '1100.00', type: 'rental_income' as const },
    { date: '2020-04-01', amount: '1100.00', type: 'rental_income' as const },
    { date: '2020-05-01', amount: '1100.00', type: 'rental_income' as const },
    { date: '2020-06-01', amount: '1100.00', type: 'rental_income' as const },
    { date: '2020-07-01', amount: '1100.00', type: 'rental_income' as const },
    { date: '2020-08-01', amount: '1100.00', type: 'rental_income' as const },
    { date: '2020-09-01', amount: '1100.00', type: 'rental_income' as const },
    { date: '2020-10-01', amount: '1100.00', type: 'rental_income' as const },
    { date: '2020-11-01', amount: '1100.00', type: 'rental_income' as const },
    { date: '2020-12-01', amount: '1100.00', type: 'rental_income' as const },
    // Kosten 2020
    { date: '2020-12-31', amount: '2400.00', type: 'cost' as const },
    // 2021
    ...Array.from({ length: 12 }, (_, i) => ({
      date:   `2021-${String(i + 1).padStart(2, '0')}-01`,
      amount: '1100.00',
      type:   'rental_income' as const,
    })),
    { date: '2021-12-31', amount: '2400.00', type: 'cost' as const },
    // 2022
    ...Array.from({ length: 12 }, (_, i) => ({
      date:   `2022-${String(i + 1).padStart(2, '0')}-01`,
      amount: '1150.00',
      type:   'rental_income' as const,
    })),
    { date: '2022-12-31', amount: '2600.00', type: 'cost' as const },
    // 2023
    ...Array.from({ length: 12 }, (_, i) => ({
      date:   `2023-${String(i + 1).padStart(2, '0')}-01`,
      amount: '1200.00',
      type:   'rental_income' as const,
    })),
    { date: '2023-12-31', amount: '2800.00', type: 'cost' as const },
    // 2024
    ...Array.from({ length: 12 }, (_, i) => ({
      date:   `2024-${String(i + 1).padStart(2, '0')}-01`,
      amount: '1250.00',
      type:   'rental_income' as const,
    })),
    { date: '2024-12-31', amount: '3000.00', type: 'cost' as const },
  ]

  await db.insert(schema.transactions).values(
    rentalTransactions.map(t => ({
      assetId:         verhuur.id,
      transactionType: t.type,
      amount:          t.amount,
      transactionDate: t.date,
      currency:        'EUR',
    }))
  )

  console.log('   Verhuurappartement aangemaakt + hypotheek + huurinkomsten/kosten')

  // ── 7. Eigen woning ───────────────────────────────────────────────────────

  const [eigenWoning] = await db.insert(schema.assets).values({
    tenantId,
    name:      'Eigen woning',
    assetType: 'real_estate',
    currency:  'EUR',
  }).returning()

  await db.insert(schema.realEstateDetails).values({
    assetId:       eigenWoning.id,
    address:       'Hoofdstraat 10, Utrecht',
    propertyType:  'primary_residence',
    purchasePrice: '380000.00',
    purchaseCosts: '11400.00',
    purchaseDate:  '2019-06-01',
    wozValue:      '420000.00',
  })

  await db.insert(schema.assetValuations).values({
    assetId:       eigenWoning.id,
    valuationDate: '2024-12-31',
    value:         '420000.00',
    currency:      'EUR',
  })

  const [hypotheekEigen] = await db.insert(schema.mortgages).values({
    assetId:        eigenWoning.id,
    lender:         'ABN AMRO',
    originalAmount: '340000.00',
    interestRate:   '0.0175',
    startDate:      '2019-06-01',
    endDate:        '2049-06-01',
    mortgageType:   'annuity',
  }).returning()

  await db.insert(schema.mortgageBalances).values({
    mortgageId:         hypotheekEigen.id,
    balanceDate:        '2024-12-31',
    outstandingBalance: '310000.00',
  })

  console.log('   Eigen woning aangemaakt + hypotheek + valuation')

  // ── Afronden ──────────────────────────────────────────────────────────────

  await pgClient.end()
  console.log('✅ Seed compleet!')
  console.log(`\n   Login: ${TEST_EMAIL} / ${TEST_PASSWORD}`)
}

seed().catch((err) => {
  console.error('❌ Seed mislukt:', err)
  process.exit(1)
})
