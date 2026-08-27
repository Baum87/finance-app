import {
  pgTable, uuid, text, boolean, numeric, date,
  timestamp, integer, index, unique, check,
} from 'drizzle-orm/pg-core'
import { sql, relations } from 'drizzle-orm'

// ─── tenants ────────────────────────────────────────────────────────────────

export const tenants = pgTable('tenants', {
  id:        uuid('id').primaryKey().defaultRandom(),
  name:      text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─── users (mirrors auth.users) ─────────────────────────────────────────────
// FK to auth.users is added via trigger.sql (cross-schema, not managed by Drizzle)

export const users = pgTable('users', {
  id:        uuid('id').primaryKey(),
  email:     text('email').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─── tenant_users ────────────────────────────────────────────────────────────

export const tenantUsers = pgTable('tenant_users', {
  id:       uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  userId:   uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role:     text('role').notNull().default('owner'),
  joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique('tenant_users_tenant_user_unique').on(t.tenantId, t.userId),
  check('tenant_users_role_check', sql`${t.role} IN ('owner', 'member')`),
  index('tenant_users_user_id_idx').on(t.userId),
])

// ─── assets ──────────────────────────────────────────────────────────────────

export const assets = pgTable('assets', {
  id:        uuid('id').primaryKey().defaultRandom(),
  tenantId:  uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name:      text('name').notNull(),
  assetType: text('asset_type').notNull(),
  currency:  text('currency').notNull().default('EUR'),
  isActive:  boolean('is_active').notNull().default(true),
  isLiquid:  boolean('is_liquid').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('assets_tenant_id_idx').on(t.tenantId),
  index('assets_asset_type_idx').on(t.assetType),
  check('assets_asset_type_check', sql`${t.assetType} IN ('stock_etf', 'crypto', 'savings', 'real_estate', 'pension', 'vordering')`),
])

// ─── transactions ─────────────────────────────────────────────────────────────

export const transactions = pgTable('transactions', {
  id:              uuid('id').primaryKey().defaultRandom(),
  assetId:         uuid('asset_id').notNull().references(() => assets.id, { onDelete: 'cascade' }),
  transactionType: text('transaction_type').notNull(),
  amount:          numeric('amount', { precision: 15, scale: 2 }).notNull(),
  fees:            numeric('fees', { precision: 15, scale: 2 }).notNull().default('0'),
  quantity:        numeric('quantity', { precision: 15, scale: 8 }),
  pricePerUnit:    numeric('price_per_unit', { precision: 15, scale: 4 }),
  transactionDate: date('transaction_date').notNull(),
  currency:        text('currency').notNull().default('EUR'),
  fxRate:          numeric('fx_rate', { precision: 15, scale: 6 }).notNull().default('1'),
  notes:           text('notes'),
  // Broker-specifieke unieke referentie (bv. Degiro "Order ID"), gezet bij xlsx-import.
  // Voorkomt dubbele import van dezelfde transactie bij een herupload — zie
  // lib/services/import. Null bij handmatig ingevoerde transacties (Postgres
  // behandelt NULL nooit als gelijk aan NULL, dus die botsen niet met de unique-constraint).
  externalRef:     text('external_ref'),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('transactions_asset_id_idx').on(t.assetId),
  index('transactions_date_idx').on(t.transactionDate),
  check('transactions_type_check', sql`${t.transactionType} IN ('buy', 'sell', 'deposit', 'withdrawal', 'dividend', 'interest', 'rental_income', 'cost')`),
  check('transactions_amount_check', sql`${t.amount} >= 0`),
  check('transactions_fees_check', sql`${t.fees} >= 0`),
  check('transactions_quantity_check', sql`${t.quantity} >= 0`),
  check('transactions_price_per_unit_check', sql`${t.pricePerUnit} >= 0`),
  unique('transactions_asset_external_ref_unique').on(t.assetId, t.externalRef),
])

// ─── asset_valuations ────────────────────────────────────────────────────────

export const assetValuations = pgTable('asset_valuations', {
  id:            uuid('id').primaryKey().defaultRandom(),
  assetId:       uuid('asset_id').notNull().references(() => assets.id, { onDelete: 'cascade' }),
  valuationDate: date('valuation_date').notNull(),
  value:         numeric('value', { precision: 15, scale: 2 }).notNull(),
  currency:      text('currency').notNull().default('EUR'),
  createdAt:     timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('asset_valuations_asset_id_idx').on(t.assetId),
  index('asset_valuations_date_idx').on(t.valuationDate),
  check('asset_valuations_value_check', sql`${t.value} >= 0`),
])

// WOZ-waarde is bewust een aparte historie, geen extra rij in asset_valuations:
// het is de gemeentelijke taxatie voor belastingdoeleinden, niet de eigen
// inschatting van de marktwaarde (die twee lopen vaak uit elkaar). Zelfde
// "laatste rij = huidige waarde"-patroon als asset_valuations/mortgage_balances.
export const wozValues = pgTable('woz_values', {
  id:        uuid('id').primaryKey().defaultRandom(),
  assetId:   uuid('asset_id').notNull().references(() => assets.id, { onDelete: 'cascade' }),
  wozDate:   date('woz_date').notNull(),
  value:     numeric('value', { precision: 15, scale: 2 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('woz_values_asset_id_idx').on(t.assetId),
  check('woz_values_value_check', sql`${t.value} >= 0`),
])

// ─── recurring_cashflows (doorlopende huur/kosten-periodes bij vastgoed) ────
// Alternatief voor 12x dezelfde rental_income/cost-transactie los invoeren:
// 1 rij per periode (vanaf-datum, evt. tot-datum, bedrag per maand). Verandert
// de huur? Dan krijgt de oude periode een endDate en komt er een nieuwe rij.
// endDate = null betekent "nog actief". Staat los van `transactions` — telt
// er in de jaartotalen (huurrendement, cash-on-cash) gewoon bovenop, dus
// bestaande losse rental_income/cost-transacties hoeven niet gemigreerd.
// frequency 'once' is voor een eenmalige kostenpost zonder maandelijkse herhaling.

export const recurringCashflows = pgTable('recurring_cashflows', {
  id:           uuid('id').primaryKey().defaultRandom(),
  assetId:      uuid('asset_id').notNull().references(() => assets.id, { onDelete: 'cascade' }),
  cashflowType: text('cashflow_type').notNull(),
  amount:       numeric('amount', { precision: 15, scale: 2 }).notNull(),
  frequency:    text('frequency').notNull().default('monthly'),
  startDate:    date('start_date').notNull(),
  endDate:      date('end_date'),
  notes:        text('notes'),
  createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('recurring_cashflows_asset_id_idx').on(t.assetId),
  check('recurring_cashflows_type_check', sql`${t.cashflowType} IN ('rental_income', 'cost')`),
  check('recurring_cashflows_frequency_check', sql`${t.frequency} IN ('monthly', 'once')`),
  check('recurring_cashflows_amount_check', sql`${t.amount} >= 0`),
])

// ─── simple_entries (eenvoudige invoer: crypto/pensioen/spaarrekening/vastgoed) ─
// Geen "asset"-entiteit — gewoon een append-only logboek per categorie,
// getoond als lijst op de betreffende portfolio-pagina. De meest recente rij
// (op entryDate) is de huidige waarde van die categorie.

export const stockEtfEntries = pgTable('stock_etf_entries', {
  id:           uuid('id').primaryKey().defaultRandom(),
  tenantId:     uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  broker:       text('broker').notNull(),
  invested:     numeric('invested', { precision: 15, scale: 2 }).notNull(),
  currentValue: numeric('current_value', { precision: 15, scale: 2 }).notNull(),
  entryDate:    date('entry_date').notNull(),
  createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('stock_etf_entries_tenant_id_idx').on(t.tenantId),
  check('stock_etf_entries_invested_check', sql`${t.invested} >= 0`),
  check('stock_etf_entries_current_value_check', sql`${t.currentValue} >= 0`),
])

export const cryptoEntries = pgTable('crypto_entries', {
  id:           uuid('id').primaryKey().defaultRandom(),
  tenantId:     uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  broker:       text('broker').notNull(),
  invested:     numeric('invested', { precision: 15, scale: 2 }).notNull(),
  currentValue: numeric('current_value', { precision: 15, scale: 2 }).notNull(),
  entryDate:    date('entry_date').notNull(),
  createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('crypto_entries_tenant_id_idx').on(t.tenantId),
  check('crypto_entries_invested_check', sql`${t.invested} >= 0`),
  check('crypto_entries_current_value_check', sql`${t.currentValue} >= 0`),
])

export const pensionEntries = pgTable('pension_entries', {
  id:           uuid('id').primaryKey().defaultRandom(),
  tenantId:     uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  broker:       text('broker').notNull(),
  invested:     numeric('invested', { precision: 15, scale: 2 }).notNull(),
  currentValue: numeric('current_value', { precision: 15, scale: 2 }).notNull(),
  entryDate:    date('entry_date').notNull(),
  createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('pension_entries_tenant_id_idx').on(t.tenantId),
  check('pension_entries_invested_check', sql`${t.invested} >= 0`),
  check('pension_entries_current_value_check', sql`${t.currentValue} >= 0`),
])

export const savingsEntries = pgTable('savings_entries', {
  id:        uuid('id').primaryKey().defaultRandom(),
  tenantId:  uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  bank:      text('bank').notNull(),
  balance:   numeric('balance', { precision: 15, scale: 2 }).notNull(),
  entryDate: date('entry_date').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('savings_entries_tenant_id_idx').on(t.tenantId),
  check('savings_entries_balance_check', sql`${t.balance} >= 0`),
])

// ─── brokers ─────────────────────────────────────────────────────────────────

export const brokers = pgTable('brokers', {
  id:        uuid('id').primaryKey().defaultRandom(),
  tenantId:  uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name:      text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('brokers_tenant_id_idx').on(t.tenantId),
])

// ─── stock_etf_details ───────────────────────────────────────────────────────

export const stockEtfDetails = pgTable('stock_etf_details', {
  id:             uuid('id').primaryKey().defaultRandom(),
  assetId:        uuid('asset_id').notNull().unique().references(() => assets.id, { onDelete: 'cascade' }),
  ticker:         text('ticker').notNull(),
  isin:           text('isin'),
  brokerId:       uuid('broker_id').references(() => brokers.id, { onDelete: 'set null' }),
  accountType:    text('account_type').default('taxable'),
  sector:         text('sector'),
  instrumentType: text('instrument_type').default('stock'),
}, (t) => [
  index('stock_etf_details_broker_id_idx').on(t.brokerId),
])

// ─── crypto_details ───────────────────────────────────────────────────────────

export const cryptoDetails = pgTable('crypto_details', {
  id:                uuid('id').primaryKey().defaultRandom(),
  assetId:           uuid('asset_id').notNull().unique().references(() => assets.id, { onDelete: 'cascade' }),
  // Nullable: simpele invoer (broker + ingelegd + huidige waarde) heeft geen
  // ticker — geen live koers, currentValue komt dan uit asset_valuations.
  ticker:            text('ticker'),
  walletOrExchange:  text('wallet_or_exchange'),
})

// ─── savings_details ──────────────────────────────────────────────────────────

export const savingsDetails = pgTable('savings_details', {
  id:                   uuid('id').primaryKey().defaultRandom(),
  assetId:              uuid('asset_id').notNull().unique().references(() => assets.id, { onDelete: 'cascade' }),
  bankName:             text('bank_name').notNull(),
  accountType:          text('account_type').default('savings'),
  interestRate:         numeric('interest_rate', { precision: 8, scale: 4 }),
  monthlyDepositAmount: numeric('monthly_deposit_amount', { precision: 15, scale: 2 }),
}, (t) => [
  check('savings_details_interest_rate_check', sql`${t.interestRate} >= 0`),
  check('savings_details_monthly_deposit_amount_check', sql`${t.monthlyDepositAmount} >= 0`),
])

// ─── pension_details ──────────────────────────────────────────────────────────

export const pensionDetails = pgTable('pension_details', {
  id:                      uuid('id').primaryKey().defaultRandom(),
  assetId:                 uuid('asset_id').notNull().unique().references(() => assets.id, { onDelete: 'cascade' }),
  provider:                text('provider').notNull(),
  pensionType:             text('pension_type').notNull(),
  projectedAnnualBenefit:  numeric('projected_annual_benefit', { precision: 15, scale: 2 }),
}, (t) => [
  check('pension_details_projected_annual_benefit_check', sql`${t.projectedAnnualBenefit} >= 0`),
])

// ─── vordering_details ───────────────────────────────────────────────────────

export const vorderingDetails = pgTable('vordering_details', {
  id:              uuid('id').primaryKey().defaultRandom(),
  assetId:         uuid('asset_id').notNull().unique().references(() => assets.id, { onDelete: 'cascade' }),
  counterparty:    text('counterparty').notNull(),
  principalAmount: numeric('principal_amount', { precision: 15, scale: 2 }).notNull(),
  interestRate:    numeric('interest_rate', { precision: 8, scale: 4 }),
  startDate:       date('start_date'),
  endDate:         date('end_date'),
  loanType:        text('loan_type').notNull().default('family'),
}, (t) => [
  check('vordering_loan_type_check', sql`${t.loanType} IN ('family', 'business', 'other')`),
  check('vordering_principal_amount_check', sql`${t.principalAmount} >= 0`),
  check('vordering_interest_rate_check', sql`${t.interestRate} >= 0`),
])

// ─── real_estate_details ─────────────────────────────────────────────────────

export const realEstateDetails = pgTable('real_estate_details', {
  id:            uuid('id').primaryKey().defaultRandom(),
  assetId:       uuid('asset_id').notNull().unique().references(() => assets.id, { onDelete: 'cascade' }),
  street:        text('street'),
  postalCode:    text('postal_code'),
  city:          text('city'),
  propertyType:  text('property_type').notNull(),
  // Nullable: simpele invoer (straat/postcode/plaats + WOZ-waarde) vraagt geen
  // aankoopprijs/-datum — die blijven voorbehouden aan de gedetailleerde flow.
  purchasePrice: numeric('purchase_price', { precision: 15, scale: 2 }),
  purchaseCosts: numeric('purchase_costs', { precision: 15, scale: 2 }).notNull().default('0'),
  purchaseDate:  date('purchase_date'),
  wozValue:      numeric('woz_value', { precision: 15, scale: 2 }),
  isRental:      boolean('is_rental').generatedAlwaysAs(sql`property_type = 'rental'`),
}, (t) => [
  check('real_estate_property_type_check', sql`${t.propertyType} IN ('rental', 'primary_residence', 'vacation')`),
  check('real_estate_purchase_price_check', sql`${t.purchasePrice} >= 0`),
  check('real_estate_purchase_costs_check', sql`${t.purchaseCosts} >= 0`),
  check('real_estate_woz_value_check', sql`${t.wozValue} >= 0`),
])

// ─── mortgages ───────────────────────────────────────────────────────────────

export const mortgages = pgTable('mortgages', {
  id:                    uuid('id').primaryKey().defaultRandom(),
  assetId:               uuid('asset_id').notNull().references(() => assets.id, { onDelete: 'cascade' }),
  lender:                text('lender').notNull(),
  originalAmount:        numeric('original_amount', { precision: 15, scale: 2 }).notNull(),
  interestRate:          numeric('interest_rate', { precision: 8, scale: 4 }).notNull(),
  interestRateFixedUntil: date('interest_rate_fixed_until'),
  startDate:             date('start_date').notNull(),
  endDate:               date('end_date'),
  mortgageType:          text('mortgage_type').notNull(),
  isActive:              boolean('is_active').notNull().default(true),
  createdAt:             timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:             timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('mortgages_asset_id_idx').on(t.assetId),
  check('mortgages_type_check', sql`${t.mortgageType} IN ('annuity', 'linear', 'interest_only')`),
  check('mortgages_original_amount_check', sql`${t.originalAmount} >= 0`),
  check('mortgages_interest_rate_check', sql`${t.interestRate} >= 0`),
])

// ─── mortgage_balances ───────────────────────────────────────────────────────

export const mortgageBalances = pgTable('mortgage_balances', {
  id:                 uuid('id').primaryKey().defaultRandom(),
  mortgageId:         uuid('mortgage_id').notNull().references(() => mortgages.id, { onDelete: 'cascade' }),
  balanceDate:        date('balance_date').notNull(),
  outstandingBalance: numeric('outstanding_balance', { precision: 15, scale: 2 }).notNull(),
  createdAt:          timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('mortgage_balances_mortgage_id_idx').on(t.mortgageId),
  check('mortgage_balances_outstanding_balance_check', sql`${t.outstandingBalance} >= 0`),
])

// ─── liabilities ─────────────────────────────────────────────────────────────

export const liabilities = pgTable('liabilities', {
  id:            uuid('id').primaryKey().defaultRandom(),
  tenantId:      uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name:          text('name').notNull(),
  liabilityType: text('liability_type').notNull(),
  amount:        numeric('amount', { precision: 15, scale: 2 }).notNull(),
  interestRate:  numeric('interest_rate', { precision: 8, scale: 4 }),
  startDate:     date('start_date'),
  endDate:       date('end_date'),
  currency:      text('currency').notNull().default('EUR'),
  isActive:      boolean('is_active').notNull().default(true),
  createdAt:     timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:     timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('liabilities_tenant_id_idx').on(t.tenantId),
  check('liabilities_amount_check', sql`${t.amount} >= 0`),
  check('liabilities_interest_rate_check', sql`${t.interestRate} >= 0`),
])

// ─── recurring_items (vaste lasten & inkomsten) ──────────────────────────────
// Eenvoudige registratie van terugkerende posten (verzekering, abonnement,
// hypotheek, gemeentelijke belasting, boodschappen, salaris). Het bedrag zelf
// staat niet hier maar in recurring_item_amounts (append-only historie) —
// zelfde patroon als assets + asset_valuations. Stoppen is isActive=false.
// Voedt de FIRE-berekening: annualExpenses/annualContribution komen hieruit i.p.v.
// een handmatig ingevoerd getal.

export const recurringItems = pgTable('recurring_items', {
  id:        uuid('id').primaryKey().defaultRandom(),
  tenantId:  uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name:      text('name').notNull(),
  itemType:  text('item_type').notNull(),
  category:  text('category').notNull(),
  frequency: text('frequency').notNull(),
  // Gezamenlijk betaald (bijv. vanaf een gedeelde rekening met een partner) —
  // puur een zichtbaarheidsmarkering, geen splitsing/percentage-logica.
  isShared:  boolean('is_shared').notNull().default(false),
  isActive:  boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('recurring_items_tenant_id_idx').on(t.tenantId),
  check('recurring_items_item_type_check', sql`${t.itemType} IN ('income', 'expense')`),
  check('recurring_items_category_check', sql`${t.category} IN ('salary', 'insurance', 'subscription', 'mortgage', 'municipal_tax', 'groceries', 'other')`),
  check('recurring_items_frequency_check', sql`${t.frequency} IN ('monthly', 'four_weekly', 'quarterly', 'yearly')`),
])

// ─── recurring_item_amounts (bedraghistorie per vaste last/inkomen) ─────────
// Append-only: elke wijziging voegt een rij toe i.p.v. te overschrijven, zodat
// oudere periodes hun eigen bedrag behouden (bijv. zorgverzekering was €100 t/m
// maart, daarna €120). De rij met de meest recente effective_date is het
// huidige bedrag — zelfde "meest recente rij = huidige waarde"-patroon als
// asset_valuations en de simple_entries-tabellen.

export const recurringItemAmounts = pgTable('recurring_item_amounts', {
  id:               uuid('id').primaryKey().defaultRandom(),
  recurringItemId:  uuid('recurring_item_id').notNull().references(() => recurringItems.id, { onDelete: 'cascade' }),
  amount:           numeric('amount', { precision: 15, scale: 2 }).notNull(),
  effectiveDate:    date('effective_date').notNull(),
  createdAt:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('recurring_item_amounts_item_id_idx').on(t.recurringItemId),
  index('recurring_item_amounts_effective_date_idx').on(t.effectiveDate),
  check('recurring_item_amounts_amount_check', sql`${t.amount} >= 0`),
])

// ─── one_time_expenses (eenmalige grote aankopen) ────────────────────────────
// Losstaande uitgaven op één datum (bijv. nieuwe bank, verbouwing) — geen
// periodieke herhaling zoals recurring_items, dus geen frequency/annualisatie.
// Telt apart mee als "dit jaar uitgegeven", niet in de maandelijkse
// cashflow-KPI's (dat zou het doorlopende karakter daarvan verstoren).

export const oneTimeExpenses = pgTable('one_time_expenses', {
  id:          uuid('id').primaryKey().defaultRandom(),
  tenantId:    uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name:        text('name').notNull(),
  category:    text('category').notNull().default('other'),
  amount:      numeric('amount', { precision: 15, scale: 2 }).notNull(),
  expenseDate: date('expense_date').notNull(),
  isShared:    boolean('is_shared').notNull().default(false),
  createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:   timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('one_time_expenses_tenant_id_idx').on(t.tenantId),
  check('one_time_expenses_category_check', sql`${t.category} IN ('vacation', 'housing', 'appliances_electronics', 'furniture', 'car_transport', 'gifts_events', 'other')`),
  check('one_time_expenses_amount_check', sql`${t.amount} >= 0`),
])

// ─── goals ("Actief doel", startpagina) ──────────────────────────────────────
// Bewust maar 1 doel per tenant (unique op tenant_id) — geen geschiedenis of
// meerdere gelijktijdige doelen, sluit aan bij "Actief doel" (enkelvoud) in
// frontend.md: "Één kaart. Geen afleidingen." targetAmount is null bij
// goalType 'passive_income_coverage' — dat doel streeft altijd naar 100%
// dekkingsgraad, geen apart bedrag nodig.

export const goals = pgTable('goals', {
  id:           uuid('id').primaryKey().defaultRandom(),
  tenantId:     uuid('tenant_id').notNull().unique().references(() => tenants.id, { onDelete: 'cascade' }),
  name:         text('name').notNull(),
  goalType:     text('goal_type').notNull(),
  targetAmount: numeric('target_amount', { precision: 15, scale: 2 }),
  targetDate:   date('target_date'),
  createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:    timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check('goals_type_check', sql`${t.goalType} IN ('savings', 'net_worth', 'passive_income_coverage')`),
  check('goals_target_amount_check', sql`${t.targetAmount} >= 0`),
])

// ─── investment_assumptions (verwacht rendement aandelen/ETF's, startpagina) ─
// Eén portefeuille-brede aanname per tenant (unique op tenant_id, zelfde
// upsert-patroon als `goals`) — geen per-asset-aanname. Procentgetal (7.0000 =
// 7%), zelfde conventie als mortgages.interestRate — geen 0.07-decimaal zoals
// XIRR/TWR-uitkomsten. Gebruikt voor de vermogensdoel-projectie op de
// startpagina (zie goal-progress.ts / calculateProjectedValue).

export const investmentAssumptions = pgTable('investment_assumptions', {
  id:                   uuid('id').primaryKey().defaultRandom(),
  tenantId:             uuid('tenant_id').notNull().unique().references(() => tenants.id, { onDelete: 'cascade' }),
  expectedAnnualReturn: numeric('expected_annual_return', { precision: 8, scale: 4 }).notNull(),
  createdAt:            timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:            timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check('investment_assumptions_return_check', sql`${t.expectedAnnualReturn} >= -100`),
])

// ─── stock_annual_returns (werkelijk rendement per kalenderjaar) ────────────
// Handmatig door de gebruiker vastgesteld aan het eind van elk jaar — geen
// koppeling aan transacties/waarderingen (bewuste keuze, zie stappenplan.md).

export const stockAnnualReturns = pgTable('stock_annual_returns', {
  id:        uuid('id').primaryKey().defaultRandom(),
  tenantId:  uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  year:      integer('year').notNull(),
  returnPct: numeric('return_pct', { precision: 8, scale: 4 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('stock_annual_returns_tenant_id_idx').on(t.tenantId),
  unique('stock_annual_returns_tenant_year_unique').on(t.tenantId, t.year),
  check('stock_annual_returns_return_check', sql`${t.returnPct} >= -100`),
])

// ─── fx_rates (geen RLS — gedeeld, niet user-gebonden) ───────────────────────
// Gereserveerd voor multi-currency / Optie B (transactievaluta met automatische
// EUR-omrekening). Nog niet in gebruik in v1: alle transacties worden in EUR
// ingevoerd (currency=EUR, fxRate=1). Niet verwijderen — verwijdering vereist
// een aparte migratie wanneer Optie B wordt ingevoerd.

export const fxRates = pgTable('fx_rates', {
  id:           uuid('id').primaryKey().defaultRandom(),
  fromCurrency: text('from_currency').notNull(),
  toCurrency:   text('to_currency').notNull(),
  rate:         numeric('rate', { precision: 15, scale: 6 }).notNull(),
  rateDate:     date('rate_date').notNull(),
  createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique('fx_rates_currency_date_unique').on(t.fromCurrency, t.toCurrency, t.rateDate),
])

// ─── asset_tax_metadata ──────────────────────────────────────────────────────

export const assetTaxMetadata = pgTable('asset_tax_metadata', {
  id:        uuid('id').primaryKey().defaultRandom(),
  assetId:   uuid('asset_id').notNull().unique().references(() => assets.id, { onDelete: 'cascade' }),
  box:       integer('box').notNull(),
  isExempt:  boolean('is_exempt').notNull().default(false),
  notes:     text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check('asset_tax_metadata_box_check', sql`${t.box} IN (1, 2, 3)`),
])

// ─── Relations ───────────────────────────────────────────────────────────────

export const tenantsRelations = relations(tenants, ({ many, one }) => ({
  tenantUsers:      many(tenantUsers),
  assets:           many(assets),
  liabilities:      many(liabilities),
  brokers:          many(brokers),
  recurringItems:   many(recurringItems),
  oneTimeExpenses:  many(oneTimeExpenses),
  goal:             one(goals, { fields: [tenants.id], references: [goals.tenantId] }),
}))

export const brokersRelations = relations(brokers, ({ one, many }) => ({
  tenant:         one(tenants, { fields: [brokers.tenantId], references: [tenants.id] }),
  stockEtfDetails: many(stockEtfDetails),
}))

export const usersRelations = relations(users, ({ many }) => ({
  tenantUsers: many(tenantUsers),
}))

export const tenantUsersRelations = relations(tenantUsers, ({ one }) => ({
  tenant: one(tenants, { fields: [tenantUsers.tenantId], references: [tenants.id] }),
  user:   one(users,   { fields: [tenantUsers.userId],   references: [users.id] }),
}))

export const assetsRelations = relations(assets, ({ one, many }) => ({
  tenant:            one(tenants, { fields: [assets.tenantId], references: [tenants.id] }),
  transactions:      many(transactions),
  valuations:        many(assetValuations),
  wozValues:         many(wozValues),
  recurringCashflows: many(recurringCashflows),
  stockEtfDetails:   one(stockEtfDetails,   { fields: [assets.id], references: [stockEtfDetails.assetId] }),
  cryptoDetails:     one(cryptoDetails,      { fields: [assets.id], references: [cryptoDetails.assetId] }),
  savingsDetails:    one(savingsDetails,     { fields: [assets.id], references: [savingsDetails.assetId] }),
  pensionDetails:    one(pensionDetails,     { fields: [assets.id], references: [pensionDetails.assetId] }),
  realEstateDetails: one(realEstateDetails,  { fields: [assets.id], references: [realEstateDetails.assetId] }),
  vorderingDetails:  one(vorderingDetails,   { fields: [assets.id], references: [vorderingDetails.assetId] }),
  mortgages:         many(mortgages),
  taxMetadata:       one(assetTaxMetadata,   { fields: [assets.id], references: [assetTaxMetadata.assetId] }),
}))

export const stockEtfDetailsRelations = relations(stockEtfDetails, ({ one }) => ({
  asset:  one(assets,  { fields: [stockEtfDetails.assetId],  references: [assets.id] }),
  broker: one(brokers, { fields: [stockEtfDetails.brokerId], references: [brokers.id] }),
}))

export const cryptoDetailsRelations = relations(cryptoDetails, ({ one }) => ({
  asset: one(assets, { fields: [cryptoDetails.assetId], references: [assets.id] }),
}))

export const savingsDetailsRelations = relations(savingsDetails, ({ one }) => ({
  asset: one(assets, { fields: [savingsDetails.assetId], references: [assets.id] }),
}))

export const pensionDetailsRelations = relations(pensionDetails, ({ one }) => ({
  asset: one(assets, { fields: [pensionDetails.assetId], references: [assets.id] }),
}))

export const realEstateDetailsRelations = relations(realEstateDetails, ({ one }) => ({
  asset: one(assets, { fields: [realEstateDetails.assetId], references: [assets.id] }),
}))

export const vorderingDetailsRelations = relations(vorderingDetails, ({ one }) => ({
  asset: one(assets, { fields: [vorderingDetails.assetId], references: [assets.id] }),
}))

export const assetTaxMetadataRelations = relations(assetTaxMetadata, ({ one }) => ({
  asset: one(assets, { fields: [assetTaxMetadata.assetId], references: [assets.id] }),
}))

export const transactionsRelations = relations(transactions, ({ one }) => ({
  asset: one(assets, { fields: [transactions.assetId], references: [assets.id] }),
}))

export const assetValuationsRelations = relations(assetValuations, ({ one }) => ({
  asset: one(assets, { fields: [assetValuations.assetId], references: [assets.id] }),
}))

export const wozValuesRelations = relations(wozValues, ({ one }) => ({
  asset: one(assets, { fields: [wozValues.assetId], references: [assets.id] }),
}))

export const recurringCashflowsRelations = relations(recurringCashflows, ({ one }) => ({
  asset: one(assets, { fields: [recurringCashflows.assetId], references: [assets.id] }),
}))

export const mortgagesRelations = relations(mortgages, ({ one, many }) => ({
  asset:    one(assets, { fields: [mortgages.assetId], references: [assets.id] }),
  balances: many(mortgageBalances),
}))

export const mortgageBalancesRelations = relations(mortgageBalances, ({ one }) => ({
  mortgage: one(mortgages, { fields: [mortgageBalances.mortgageId], references: [mortgages.id] }),
}))

export const liabilitiesRelations = relations(liabilities, ({ one }) => ({
  tenant: one(tenants, { fields: [liabilities.tenantId], references: [tenants.id] }),
}))

export const recurringItemsRelations = relations(recurringItems, ({ one, many }) => ({
  tenant:  one(tenants, { fields: [recurringItems.tenantId], references: [tenants.id] }),
  amounts: many(recurringItemAmounts),
}))

export const recurringItemAmountsRelations = relations(recurringItemAmounts, ({ one }) => ({
  recurringItem: one(recurringItems, { fields: [recurringItemAmounts.recurringItemId], references: [recurringItems.id] }),
}))

export const oneTimeExpensesRelations = relations(oneTimeExpenses, ({ one }) => ({
  tenant: one(tenants, { fields: [oneTimeExpenses.tenantId], references: [tenants.id] }),
}))

export const goalsRelations = relations(goals, ({ one }) => ({
  tenant: one(tenants, { fields: [goals.tenantId], references: [tenants.id] }),
}))

export const investmentAssumptionsRelations = relations(investmentAssumptions, ({ one }) => ({
  tenant: one(tenants, { fields: [investmentAssumptions.tenantId], references: [tenants.id] }),
}))

export const stockAnnualReturnsRelations = relations(stockAnnualReturns, ({ one }) => ({
  tenant: one(tenants, { fields: [stockAnnualReturns.tenantId], references: [tenants.id] }),
}))
