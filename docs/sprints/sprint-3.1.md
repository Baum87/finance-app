# Sprint 3.1 — Transacties & assets

**Datum:** 12 juni 2026
**Status:** Afgerond
**Commits:** nog te committen

## Doel

Assets en transacties kunnen aanmaken, bekijken, bewerken en verwijderen via de UI. Na afloop kan een gebruiker zijn volledige portfolio handmatig invoeren.

---

## Wat is gebouwd

### Query-laag (`src/lib/db/queries/`)

**`assets.ts`**
- `getTenantId(userId)` — private helper, haalt de tenant op voor de ingelogde user
- `getAssets(userId)` — alle actieve assets met detail-tabellen via Drizzle relational queries
- `getAsset(userId, assetId)` — één asset inclusief details, hypotheken en laatste 5 valuaties
- `createAsset(userId, data)` — insert in `assets` + bijbehorende detail-tabel in één transactie
- `updateAsset(userId, assetId, data)` — update basis + detail-tabel in één transactie
- `deleteAsset(userId, assetId)` — soft delete via `is_active = false`, geen hard delete

**`transactions.ts`**
- `verifyAssetAccess` / `verifyTransactionAccess` — ownership checks via tenant_users join
- `getTransactions(userId, assetId)` — gesorteerd op datum DESC
- `createTransaction`, `updateTransaction`, `deleteTransaction` — volledige CRUD

Alle query-functies filteren expliciet op `userId` via de `tenant_users` tabel — extra laag bovenop RLS.

---

### Server Actions (`src/app/assets/actions.ts`)

Zod-schemas per asset-type en voor transacties. Acties:

| Actie | Gedrag bij succes |
|---|---|
| `createAssetAction` | redirect naar `/assets/[id]` |
| `updateAssetAction` | redirect naar `/assets/[id]` |
| `deleteAssetAction` | redirect naar `/assets` |
| `createTransactionAction` | redirect naar `/assets/[id]` |
| `updateTransactionAction` | redirect naar `/assets/[id]` |
| `deleteTransactionAction` | redirect naar `/assets/[id]` |

Errors worden teruggegeven als `{ error: string }` — nooit silent. Redirect-errors worden correct doorgegeven aan Next.js via `isRedirectError`.

---

### Componenten (`src/components/assets/`)

**`AssetList`**
- shadcn `Table` met naam, type-badge, valuta en laatste waarde
- Lege staat met uitnodigende CTA: "Voeg je eerste asset toe"
- Delete-knop met `confirm()` en soft delete via Server Action

**`AssetForm`** (`"use client"`)
- Basis: naam, type-selector, valuta
- Conditionele secties per type (alleen de relevante sectie wordt gerenderd):
  - `stock_etf` — ticker, ISIN, broker, accounttype
  - `crypto` — symbol, wallet/exchange
  - `savings` — bank, rekeningtype, rente
  - `pension` — aanbieder, type, verwachte jaaruitkering
  - `real_estate` — adres, type, aankoopprijs, kosten, datum, WOZ + optionele hypotheeksectie
- Edit-mode via `initialData` prop, type-selector disabled bij bewerken
- `useActionState` voor pending-state en foutweergave

**`TransactionList`**
- Compacte tabel: datum, type-badge, bedrag, aantal, notitie
- Lege staat met CTA
- Delete per rij via Server Action

**`TransactionForm`** (`"use client"`)
- Type-selector bepaalt conditionele velden: aantal + koers alleen bij `buy`/`sell`
- `inputMode="decimal"` voor geldbedragen (geen floating point in het formulier)
- Datum vult automatisch vandaag in als default

---

### Routes

| Route | Component | Beschrijving |
|---|---|---|
| `/assets` | Server Component | Portfolio-overzicht met AssetList |
| `/assets/new` | Server Component + AssetForm | Nieuw asset aanmaken |
| `/assets/[id]` | Server Component | Detail: KPI-cards + details + TransactionList |
| `/assets/[id]/edit` | Server Component + AssetForm | Asset bewerken |
| `/assets/[id]/transactions/new` | Server Component + TransactionForm | Transactie toevoegen |

---

## Wat NIET gebouwd is (bewust buiten scope)

- Rendementsberekeningen (XIRR, TWR) → Sprint 3.2
- Koersdatakoppeling → Sprint 3.2
- "Huidige waarde" berekend op basis van transacties → Sprint 3.2
- Dashboard en grafieken → Sprint 3.3
- CSV-import → Sprint 4.1

---

## Openstaand aandachtspunt

De Drizzle-client (`src/lib/db/index.ts`) gebruikt `SUPABASE_DB_URL` (directe verbinding, poort 5432). Dit was tijdens Sprint 2.2 geblokkeerd door het netwerk voor drizzle-kit, maar werkt mogelijk wel voor app-queries. Als de verbinding faalt in de app:

Voeg toe aan `.env.local`:
```
DATABASE_URL=postgresql://postgres.[project-ref]:[wachtwoord]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres
```

En update `src/lib/db/index.ts`:
```ts
const client = postgres(process.env.DATABASE_URL ?? process.env.SUPABASE_DB_URL!, { prepare: false })
```

De transaction pooler (poort 6543) is ontworpen voor serverless omgevingen en omzeilt firewall-beperkingen op poort 5432.
