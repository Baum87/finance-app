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
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('transactions_asset_id_idx').on(t.assetId),
  index('transactions_date_idx').on(t.transactionDate),
  check('transactions_type_check', sql`${t.transactionType} IN ('buy', 'sell', 'deposit', 'withdrawal', 'dividend', 'interest', 'rental_income', 'cost')`),
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
  broker:         text('broker'),
  accountType:    text('account_type').default('taxable'),
  sector:         text('sector'),
  instrumentType: text('instrument_type').default('stock'),
})

// ─── crypto_details ───────────────────────────────────────────────────────────

export const cryptoDetails = pgTable('crypto_details', {
  id:                uuid('id').primaryKey().defaultRandom(),
  assetId:           uuid('asset_id').notNull().unique().references(() => assets.id, { onDelete: 'cascade' }),
  ticker:            text('ticker').notNull(),
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
  address:       text('address'),
  propertyType:  text('property_type').notNull(),
  purchasePrice: numeric('purchase_price', { precision: 15, scale: 2 }).notNull(),
  purchaseCosts: numeric('purchase_costs', { precision: 15, scale: 2 }).notNull().default('0'),
  purchaseDate:  date('purchase_date').notNull(),
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

// ─── fx_rates (geen RLS — gedeeld, niet user-gebonden) ───────────────────────

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
  tenantUsers: many(tenantUsers),
  assets:      many(assets),
  liabilities: many(liabilities),
  brokers:     many(brokers),
}))

export const brokersRelations = relations(brokers, ({ one }) => ({
  tenant: one(tenants, { fields: [brokers.tenantId], references: [tenants.id] }),
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
  asset: one(assets, { fields: [stockEtfDetails.assetId], references: [assets.id] }),
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
