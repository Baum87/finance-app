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
])

export const realEstateEntries = pgTable('real_estate_entries', {
  id:         uuid('id').primaryKey().defaultRandom(),
  tenantId:   uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  street:     text('street').notNull(),
  postalCode: text('postal_code').notNull(),
  city:       text('city').notNull(),
  wozValue:   numeric('woz_value', { precision: 15, scale: 2 }).notNull(),
  entryDate:  date('entry_date').notNull(),
  createdAt:  timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('real_estate_entries_tenant_id_idx').on(t.tenantId),
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
})

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
})

// ─── pension_details ──────────────────────────────────────────────────────────

export const pensionDetails = pgTable('pension_details', {
  id:                      uuid('id').primaryKey().defaultRandom(),
  assetId:                 uuid('asset_id').notNull().unique().references(() => assets.id, { onDelete: 'cascade' }),
  provider:                text('provider').notNull(),
  pensionType:             text('pension_type').notNull(),
  projectedAnnualBenefit:  numeric('projected_annual_benefit', { precision: 15, scale: 2 }),
})

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
  amount:      numeric('amount', { precision: 15, scale: 2 }).notNull(),
  expenseDate: date('expense_date').notNull(),
  createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:   timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('one_time_expenses_tenant_id_idx').on(t.tenantId),
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

export const tenantsRelations = relations(tenants, ({ many }) => ({
  tenantUsers:      many(tenantUsers),
  assets:           many(assets),
  liabilities:      many(liabilities),
  brokers:          many(brokers),
  recurringItems:   many(recurringItems),
  oneTimeExpenses:  many(oneTimeExpenses),
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
