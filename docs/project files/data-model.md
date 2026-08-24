# data-model.md — Personal Finance App

Laatst bijgewerkt: 11 juni 2026
Status: definitief vastgesteld (Sprint 1.3) — bijgewerkt met multi-tenant fundament

---

## Vastgestelde contracten

| Onderwerp | Besluit |
|---|---|
| Geldrepresentatie | `numeric(15,2)` — exact, geen float, geen centen-conversie |
| Rendementen | Decimaal: `0.07` = 7%. UI vermenigvuldigt ×100 voor weergave |
| Datums (transacties) | `date` (YYYY-MM-DD) — leidend voor XIRR |
| Datums (audit) | `timestamptz` in UTC |
| Afronden | Uitsluitend bij weergave, nooit in tussenberekeningen |
| Primaire valuta | EUR |

---

## Ontwerpprincipes

**Twee soorten assets, twee manieren van waardering:**
- *Transactie-gedreven* (aandelen/ETF, crypto): waarde = bezit × koers. Berekend.
- *Handmatig gewaardeerd* (vastgoed, pensioen, spaargeld): waarde periodiek ingevoerd via `asset_valuations`. Geen verplichte transactie-administratie waar die niet zinvol is.

**Berekeningen in de applicatielaag:** Supabase is datastore, niet rekenmotor. XIRR, TWR, rendement en netto vermogen draaien als pure TypeScript-functies in `lib/finance`. Zie finance-logic.md.

**RLS op alle tabellen:** elke tabel bevat `user_id` als RLS-anker. Data-isolatie per gebruiker: wie inlogt ziet alleen zijn eigen data. De `tenants`-laag maakt gedeelde portfolios later mogelijk zonder refactor.

---

## Schema

### Kern

```sql
-- Tenants: gedeelde app-instantie, geïsoleerde data per gebruiker.
-- Nu: elke gebruiker is zijn eigen tenant.
-- Later: gedeeld portfolio mogelijk door meerdere users aan één tenant te koppelen.
CREATE TABLE tenants (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Koppeltabel users <-> tenants.
-- Nu: één user, één tenant. Later: meerdere users per tenant mogelijk.
CREATE TABLE tenant_users (
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'owner'
              CHECK (role IN ('owner', 'member')),
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, user_id)
);

-- Minimaal; anker voor RLS. Gespiegeld aan Supabase auth.users.
CREATE TABLE users (
  id          UUID PRIMARY KEY,  -- = auth.users.id
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE assets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN (
                'stock_etf', 'crypto', 'savings', 'real_estate', 'pension'
              )),
  name        TEXT NOT NULL,          -- "VWRL", "BTC", "Spaarrekening ING"
  currency    TEXT NOT NULL DEFAULT 'EUR',
  is_active   BOOLEAN NOT NULL DEFAULT true,
  is_liquid   BOOLEAN NOT NULL DEFAULT true,
  -- false voor vastgoed en pensioen; leidend voor liquide/vastgezet-splitsing
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

`is_liquid` is een domein-eigenschap, geen berekening: vastgoed en pensioen zijn altijd `false`, savings/stocks/crypto zijn `true`. Bepaald bij aanmaken, niet afgeleid.

**RLS-logica voor assets:**
```sql
-- User ziet assets van tenants waar hij lid van is
CREATE POLICY "tenant_isolation" ON assets
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
  );
```

---

### Transacties

```sql
CREATE TABLE transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id        UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id),  -- RLS
  date            DATE NOT NULL,
  type            TEXT NOT NULL CHECK (type IN (
                    'buy',            -- aankoop aandelen/crypto/vastgoed
                    'sell',           -- verkoop
                    'deposit',        -- storting (spaar, pensioen)
                    'withdrawal',     -- onttrekking
                    'dividend',       -- dividend uitkering
                    'interest',       -- rente bijschrijving
                    'rental_income',  -- huurinkomsten
                    'cost'            -- kosten (onderhoud, VvE, verzekering)
                  )),
  amount          NUMERIC(15,2) NOT NULL CHECK (amount >= 0),
  -- Altijd positief. Richting (in/uit) zit in `type`.
  -- in:  buy, deposit, dividend, interest, rental_income
  -- uit: sell, withdrawal, cost
  units           NUMERIC(18,8),      -- aandelen/crypto: aantal
  price_per_unit  NUMERIC(15,6),      -- koers op transactiedatum
  fees            NUMERIC(15,2) NOT NULL DEFAULT 0,
  currency        TEXT NOT NULL DEFAULT 'EUR',
  tax_year        INT,                -- toekomst: box-3-berekeningen
  is_tax_relevant BOOLEAN NOT NULL DEFAULT false,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Cashflow-semantiek voor XIRR** (zie finance-logic.md):
- `buy`, `deposit` → negatieve cashflow (geld weg)
- `sell`, `withdrawal`, `dividend`, `interest`, `rental_income` → positieve cashflow
- `cost` → negatieve cashflow (reduceert rendement vastgoed)

> **Let op — dit codeblok is het oorspronkelijke ontwerp uit Sprint 1.3, niet 1-op-1
> de huidige implementatie.** De werkelijke kolomnamen staan in `lib/db/schema.ts`
> (o.a. `transaction_date`, `transaction_type`, `quantity`, `fx_rate` i.p.v.
> `date`/`type`/`units`; `tax_year`/`is_tax_relevant` bestaan niet, box-3-koppeling
> loopt via `asset_tax_metadata`). Schema.ts is bron van waarheid, niet dit bestand.
>
> **Migratie 0007** voegt `external_ref` (nullable text) toe, met een unieke
> combinatie `(asset_id, external_ref)`. Slaat de broker-eigen transactie-ID op
> (bv. Degiro's "Order ID") bij xlsx-import, zodat een herupload van hetzelfde
> bestand nooit tot dubbele transacties leidt (`ON CONFLICT DO NOTHING`). Blijft
> `NULL` bij handmatig ingevoerde transacties. Zie `lib/services/import/`.

---

### Universele waarderingen

```sql
-- Handmatig gewaardeerde assets: vastgoed, pensioen, spaargeld.
-- Meest recente rij per asset_id = huidige waarde.
CREATE TABLE asset_valuations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id        UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id),
  valuation_date  DATE NOT NULL,
  value           NUMERIC(15,2) NOT NULL,
  source          TEXT,
  -- 'woz' | 'taxatie' | 'eigen_schatting' | 'upo' | 'bankafschrift'
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (asset_id, valuation_date)
);
```

Spaargeld: maandelijks saldo overtypen volstaat. Rente zit impliciet in de waardestijging.
Pensioen: jaarlijks UPO-waarde invoeren.
Vastgoed: jaarlijks WOZ of taxatiewaarde invoeren.

---

### Asset-specifieke detail-tabellen

```sql
-- Aandelen & ETFs
CREATE TABLE stock_etf_details (
  asset_id   UUID PRIMARY KEY REFERENCES assets(id) ON DELETE CASCADE,
  ticker     TEXT,           -- "VWRL", "AAPL"
  isin       TEXT,
  broker     TEXT,           -- "DEGIRO", "Saxo"
  benchmark  TEXT DEFAULT 'MSCI World'
);

-- Crypto
CREATE TABLE crypto_details (
  asset_id            UUID PRIMARY KEY REFERENCES assets(id) ON DELETE CASCADE,
  symbol              TEXT NOT NULL,   -- "BTC", "ETH"
  wallet_or_exchange  TEXT
);

-- Spaargeld & deposito's
CREATE TABLE savings_details (
  asset_id       UUID PRIMARY KEY REFERENCES assets(id) ON DELETE CASCADE,
  bank           TEXT,
  account_type   TEXT CHECK (account_type IN ('savings', 'deposit', 'notice')),
  interest_rate  NUMERIC(8,6),   -- 0.035 = 3.5%; indicatief, actuele waarde via valuations
  maturity_date  DATE            -- voor deposito's
);

-- Pensioen
CREATE TABLE pension_details (
  asset_id     UUID PRIMARY KEY REFERENCES assets(id) ON DELETE CASCADE,
  provider     TEXT,            -- "ABP", "NN"
  type         TEXT CHECK (type IN ('employer', 'annuity', 'third_pillar')),
  pension_age  INT              -- verwachte pensioenleeftijd
);
```

---

### Vastgoed — speciaal geval

```sql
CREATE TABLE real_estate_details (
  asset_id        UUID PRIMARY KEY REFERENCES assets(id) ON DELETE CASCADE,
  property_type   TEXT NOT NULL CHECK (property_type IN ('primary_residence', 'rental')),
  address         TEXT,
  purchase_date   DATE NOT NULL,
  purchase_price  NUMERIC(15,2) NOT NULL,
  purchase_costs  NUMERIC(15,2) NOT NULL DEFAULT 0,
  -- overdrachtsbelasting, notaris, makelaarskosten
  -- aankoopwaarde = purchase_price + purchase_costs
  -- dit is de noemer voor bruto/netto huurrendement en ROE-berekeningen
  is_rental       BOOLEAN GENERATED ALWAYS AS (property_type = 'rental') STORED
);

-- Hypotheek — gekoppeld aan vastgoed-asset
CREATE TABLE mortgages (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id                  UUID NOT NULL REFERENCES real_estate_details(asset_id),
  user_id                   UUID NOT NULL REFERENCES users(id),
  lender                    TEXT,
  original_amount           NUMERIC(15,2) NOT NULL,
  interest_rate             NUMERIC(8,6) NOT NULL,   -- 0.039 = 3.9%
  interest_rate_fixed_until DATE,
  start_date                DATE NOT NULL,
  end_date                  DATE,
  is_active                 BOOLEAN NOT NULL DEFAULT true,
  notes                     TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Hypotheeksaldo-historie — handmatig bijwerken (bijv. jaarlijks)
-- Meest recente rij per mortgage_id = resterende schuld
CREATE TABLE mortgage_balances (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mortgage_id   UUID NOT NULL REFERENCES mortgages(id) ON DELETE CASCADE,
  balance_date  DATE NOT NULL,
  balance       NUMERIC(15,2) NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (mortgage_id, balance_date)
);
```

**Vastgoed-waarde:** via `asset_valuations` (zelfde tabel als pensioen/spaargeld).
**Cashflow verhuur:** via `transactions` — `rental_income` en `cost` op het vastgoed-asset.

---

### Schulden (niet-vastgoed)

```sql
CREATE TABLE liabilities (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id),
  name            TEXT NOT NULL,
  type            TEXT CHECK (type IN ('student_loan', 'personal_loan', 'other')),
  current_balance NUMERIC(15,2) NOT NULL,
  interest_rate   NUMERIC(8,6),
  start_date      DATE,
  end_date        DATE,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

### Vaste lasten & inkomsten (recurring_items + recurring_item_amounts)

```sql
-- Eenvoudige registratie van terugkerende posten (salaris, verzekering,
-- abonnement, hypotheek, gemeentelijke belasting, boodschappen). Stoppen is
-- is_active = false. Voedt de FIRE-berekening (lib/finance/recurring-cashflow.ts):
-- annualExpenses/annualContribution komen hieruit i.p.v. een handmatig getal.
CREATE TABLE recurring_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  item_type  TEXT NOT NULL CHECK (item_type IN ('income', 'expense')),
  category   TEXT NOT NULL CHECK (category IN ('salary', 'insurance', 'subscription', 'mortgage', 'municipal_tax', 'groceries', 'other')),
  frequency  TEXT NOT NULL CHECK (frequency IN ('monthly', 'four_weekly', 'quarterly', 'yearly')),
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Bedraghistorie, append-only (zelfde patroon als asset_valuations): een
-- wijziging voegt een rij toe i.p.v. te overschrijven, zodat een oudere
-- periode (bijv. zorgverzekering €100 t/m maart) intact blijft. De rij met
-- de meest recente effective_date is het huidige bedrag.
CREATE TABLE recurring_item_amounts (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recurring_item_id  UUID NOT NULL REFERENCES recurring_items(id) ON DELETE CASCADE,
  amount             NUMERIC(15,2) NOT NULL,
  effective_date     DATE NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

### Eenmalige uitgaven (one_time_expenses)

```sql
-- Losstaande grote aankopen (bijv. nieuwe bank, verbouwing) — geen frequentie/
-- annualisatie zoals recurring_items. Telt mee als "dit jaar uitgegeven" op de
-- cashflow-pagina, niet in de maandelijkse cashflow-KPI's.
CREATE TABLE one_time_expenses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  amount       NUMERIC(15,2) NOT NULL,
  expense_date DATE NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

### Valuta (FX)

```sql
-- Wisselkoersen voor niet-EUR assets (crypto, buitenlandse aandelen).
-- Benodigd voor correct EUR-totaal in netto vermogen.
-- Niet user-gebonden — gedeeld over alle tenants.
CREATE TABLE fx_rates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_currency   TEXT NOT NULL,    -- 'USD', 'BTC'
  quote_currency  TEXT NOT NULL DEFAULT 'EUR',
  rate_date       DATE NOT NULL,
  rate            NUMERIC(15,8) NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (base_currency, quote_currency, rate_date)
);
```

Gevuld door de koersdataservice (Sprint 3.2). In v1 desnoods handmatig voor crypto.

---

### Toekomstvast — belastinginzicht (box 3)

```sql
-- Nu aanmaken, leeg laten in v1. Geen refactor nodig later.
CREATE TABLE asset_tax_metadata (
  asset_id      UUID PRIMARY KEY REFERENCES assets(id) ON DELETE CASCADE,
  tax_box       TEXT CHECK (tax_box IN ('box1', 'box2', 'box3')),
  is_tax_exempt BOOLEAN NOT NULL DEFAULT false,
  tax_notes     TEXT,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

`tax_year` en `is_tax_relevant` zitten al op `transactions` (zie boven).

---

## Relatie-overzicht (ERD in tekst)

```
tenants
 └── tenant_users (N:N via users)
      └── users
           ├── assets (1:N)  [ook via tenant_id]
           │    ├── stock_etf_details (1:0-1)
           │    ├── crypto_details (1:0-1)
           │    ├── savings_details (1:0-1)
           │    ├── pension_details (1:0-1)
           │    ├── real_estate_details (1:0-1)
           │    │    └── mortgages (1:N)
           │    │         └── mortgage_balances (1:N)
           │    ├── transactions (1:N)
           │    ├── asset_valuations (1:N)
           │    └── asset_tax_metadata (1:0-1)
           └── liabilities (1:N)  [ook via tenant_id]

fx_rates  (gedeeld, niet user/tenant-gebonden)
```

---

## Indexen (aanbevolen bij aanmaken)

```sql
CREATE INDEX ON assets (tenant_id);
CREATE INDEX ON transactions (asset_id, date);
CREATE INDEX ON transactions (user_id, date);
CREATE INDEX ON asset_valuations (asset_id, valuation_date DESC);
CREATE INDEX ON mortgage_balances (mortgage_id, balance_date DESC);
CREATE INDEX ON fx_rates (base_currency, quote_currency, rate_date DESC);
CREATE INDEX ON tenant_users (user_id);
```

---

## Opengehouden uitbreidingen (geen refactor nodig)

| Uitbreiding | Hoe opengehouden |
|---|---|
| Gedeeld portfolio (meerdere users, één tenant) | `tenant_users` + `tenant_id` op assets/liabilities aanwezig |
| Belastinginzicht box 3 | `asset_tax_metadata` + `tax_year`/`is_tax_relevant` op transactions |
| AI-inzichten (Fase 4) | Supabase `pgvector` beschikbaar; geen schema-aanpassing nodig |
| Reëel rendement (na inflatie) | Berekening in `lib/finance`; geen extra tabel nodig |
| Multi-currency portfolio | `fx_rates` aanwezig; `currency` op assets en transactions |
| Self-hosting | Open-source PostgreSQL basis; geen lock-in |
