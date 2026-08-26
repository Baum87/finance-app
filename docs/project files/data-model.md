# data-model.md — Personal Finance App

Laatst bijgewerkt: 25 augustus 2026 — drift-annotaties toegevoegd na codebase-audit
(zie `docs/review/audit-codebase-volledig.md`, bevinding M-3). De originele
Sprint 1.3-ontwerpblokken zijn bewust laten staan als besluitvormingsrecord;
waar de huidige `lib/db/schema.ts` afwijkt staat dat nu expliciet vermeld i.p.v.
alleen bij `transactions`. **`schema.ts` blijft bron van waarheid, dit document
niet.**
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

### Eenvoudige invoerlijsten (simple entries) — ontbreekt hierboven, wél in schema.ts

Náást de `assets`/`asset_valuations`-flow bestaat een tweede, lichtere manier om
een categorie bij te houden: vier losstaande, append-only logboek-tabellen
zonder eigen `assets`-rij — `stock_etf_entries`, `crypto_entries`,
`pension_entries`, `savings_entries`. Elke tabel heeft
`id`, `tenant_id`, een groepssleutel (`broker`/`bank`), een waardeveld
(`invested`+`current_value`, of `balance`) en `entry_date`. De
meest recente rij per groep (op `entry_date`) is de huidige waarde — zelfde
"laatste rij = actuele waarde"-patroon als `asset_valuations`, maar dan zonder
transactiehistorie of detail-tabel. Gebruikt op de portfolio-overzichtspagina's
en de homepage (`lib/db/queries/simple-entries.ts`) naast de volledige
asset-tracking, zodat een gebruiker die bijvoorbeeld alleen "€ X op ING"
bijhoudt niet uit het totaalvermogen valt.

**Vastgoed heeft geen simple-entry-variant meer.** `real_estate_entries`
bood alleen adres + WOZ-waarde, zonder hypotheek/transacties/rendement — en
stond los van de rijkere asset-flow, wat tot verwarring leidde (zie
`stappenplan.md`, C2/vastgoed). Tabel verwijderd in migratie 0021
(`drop-real-estate-entries.sql`). Vastgoed loopt nu uitsluitend via
`assets`/`real_estate_details`/`mortgages`/`transactions`.

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

> **Let op — afwijkt van `schema.ts`:**
> - `stock_etf_details`: geen `broker`/`benchmark`-tekstvelden — i.p.v. `broker` een
>   `broker_id`-FK naar de nieuwe `brokers`-tabel (zie onder); `benchmark` bestaat
>   niet (benchmark-vergelijking loopt centraal via `lib/services/benchmark.ts`,
>   niet per positie). Kolommen `account_type`/`sector`/`instrument_type` erbij.
> - `crypto_details.symbol` heet `ticker` en is nullable (simpele invoer via
>   `crypto_entries` heeft geen ticker, geen live koers).
> - `savings_details`: `bank` heet `bank_name`; geen `maturity_date`; wel
>   `account_type` en `monthly_deposit_amount`.
> - `pension_details`: `type` heet `pension_type`; geen `pension_age`; wel
>   `projected_annual_benefit`.
> - Ontbreekt hierboven volledig: `vordering_details` (asset-type `vordering`,
>   familielening/zakelijke lening — counterparty, principal_amount,
>   interest_rate, start/end_date, loan_type) en de `brokers`-tabel
>   (id, tenant_id, name — waar `stock_etf_details.broker_id` naar verwijst).

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

> **Let op — afwijkt van `schema.ts`:** `type` heet `liability_type`,
> `current_balance` heet `amount`; er is geen `notes`-kolom, wel een
> `currency`-kolom (default `'EUR'`, ontbreekt hierboven).

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
  is_shared  BOOLEAN NOT NULL DEFAULT false, -- gezamenlijk betaald (bijv. gedeelde rekening), puur zichtbaarheid
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
  category     TEXT NOT NULL DEFAULT 'other'
               CHECK (category IN ('vacation', 'housing', 'appliances_electronics',
                                    'furniture', 'car_transport', 'gifts_events', 'other')),
  amount       NUMERIC(15,2) NOT NULL,
  expense_date DATE NOT NULL,
  is_shared    BOOLEAN NOT NULL DEFAULT false, -- gezamenlijk betaald, puur zichtbaarheid
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

> **Let op — afwijkt van `schema.ts` én van de praktijk:** kolommen heten
> `from_currency`/`to_currency` (niet `base_currency`/`quote_currency`), `rate`
> heeft precisie `(15,6)` (niet `(15,8)`). Belangrijker: de tabel is in de
> praktijk **leeg** — niet gevuld door een koersdataservice zoals hier staat.
> Alle transacties worden vooralsnog EUR-geforceerd ingevoerd (`currency='EUR'`,
> `fxRate='1'`); multi-currency ("Optie B") is ontworpen maar nog niet gebouwd.
> Niet verwijderen zonder die beslissing eerst te nemen.

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

> **Let op — afwijkt van `schema.ts`:** `tax_box` is in de praktijk `box`
> (`INTEGER CHECK (box IN (1,2,3))`, niet `TEXT CHECK (... IN ('box1','box2','box3'))`
> — een echt typeverschil, niet alleen een naamswijziging). `is_tax_exempt` heet
> `is_exempt`, `tax_notes` heet `notes`. De rij wordt aangemaakt bij elke
> `createAsset` (default box 3) maar nergens in de UI gelezen of getoond —
> voorbereid voor Fase E (fiscale laag), nog niet actief gebruikt.

---

## Relatie-overzicht (ERD in tekst)

```
tenants
 └── tenant_users (N:N via users)
      └── users
           ├── assets (1:N)  [ook via tenant_id]
           │    ├── stock_etf_details (1:0-1) ──→ brokers (N:1, optioneel)
           │    ├── crypto_details (1:0-1)
           │    ├── savings_details (1:0-1)
           │    ├── pension_details (1:0-1)
           │    ├── vordering_details (1:0-1)
           │    ├── real_estate_details (1:0-1)
           │    │    └── mortgages (1:N)
           │    │         └── mortgage_balances (1:N)
           │    ├── transactions (1:N)
           │    ├── asset_valuations (1:N)
           │    └── asset_tax_metadata (1:0-1)
           ├── brokers (1:N)  [via tenant_id — los van assets]
           ├── liabilities (1:N)  [ook via tenant_id]
           ├── recurring_items (1:N)  [via tenant_id]
           │    └── recurring_item_amounts (1:N)
           ├── one_time_expenses (1:N)  [via tenant_id]
           └── simple entries (1:N elk, via tenant_id — géén link naar assets):
                stock_etf_entries, crypto_entries, pension_entries,
                savings_entries

fx_rates  (gedeeld, niet user/tenant-gebonden — in de praktijk leeg, zie boven)
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
