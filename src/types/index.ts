// Gedeelde domeintypes — worden uitgewerkt in Sprint 2.2 en verder.
// Drizzle-schema is leidend; types worden daaruit afgeleid, niet parallel onderhouden.

// Tenant-isolatie: elke user zit in een tenant. Zie data-model.md (D-014).
export type UserRole = 'owner' | 'member'

export type AssetType =
  | 'stock_etf'
  | 'crypto'
  | 'savings'
  | 'real_estate'
  | 'pension'
  | 'vordering'

export type TransactionType =
  | 'buy'
  | 'sell'
  | 'deposit'
  | 'withdrawal'
  | 'dividend'
  | 'interest'
  | 'rental_income'
  | 'cost'
