# Sprint 3.1 — Transacties & assets

**Fase:** 3 | **Tool:** Claude Code | **Deliverable:** data invoeren werkt

---

## Context

Fase 2 is volledig afgerond:
- Dev-omgeving draait: Next.js 16.2, Tailwind v4, shadcn/ui new-york
- Drizzle-schema staat in Supabase (16 tabellen), RLS en auth werken
- Seed-data aanwezig (VWRL, BTC, spaarrekening, verhuurappartement, eigen woning)
- Visuele spec uit `frontend.md` is al toegepast op de basisstructuur

Referentiedocumenten die leidend zijn voor deze sprint: `CLAUDE.md`, `conventions.md`, `data-model.md`, `finance-logic.md`, `frontend.md`. Lees ze als je ze nog niet kent.

---

## Doel

Assets en transacties kunnen aanmaken, bekijken, bewerken en verwijderen via de UI. Na afloop kan een gebruiker zijn volledige portfolio handmatig invoeren.

---

## Wat je bouwt

### 1. Query-laag (`src/lib/db/queries/`)

Schrijf Drizzle-queryfuncties voor:

- `getAssets(userId)` — alle actieve assets van de gebruiker, inclusief hun detail-tabel via join
- `getAsset(userId, assetId)` — één asset met alle details
- `createAsset(userId, data)` — nieuw asset aanmaken, inclusief de bijbehorende detail-rij
- `updateAsset(userId, assetId, data)` — asset bijwerken
- `deleteAsset(userId, assetId)` — soft delete via `is_active = false`, geen hard delete
- `getTransactions(userId, assetId)` — transacties voor een asset, gesorteerd op datum DESC
- `createTransaction(userId, assetId, data)` — nieuwe transactie
- `updateTransaction(userId, transactionId, data)` — transactie bijwerken
- `deleteTransaction(userId, transactionId)` — transactie verwijderen

Queries zitten in `lib/db/queries/`, niet inline in componenten. Gebruik de Drizzle server-client (`supabase-server.ts`).

### 2. Server Actions (`src/app/assets/actions.ts`)

Server Actions voor alle mutaties — geen losse API-routes. Valideer input met Zod aan de rand. Geef bij fouten een duidelijke foutmelding terug — geen silent failures.

Transactie-types die ondersteund moeten worden: `buy`, `sell`, `deposit`, `withdrawal`, `dividend`, `interest`, `rental_income`, `cost`.

### 3. Pagina's en routes

```
/assets                             → overzicht van alle assets (Server Component)
/assets/new                         → formulier nieuw asset aanmaken
/assets/[id]                        → asset detail met transactielijst
/assets/[id]/edit                   → asset bewerken
/assets/[id]/transactions/new       → transactie toevoegen
```

### 4. UI-componenten

Volg de visuele spec uit `frontend.md` strak.

**`AssetList`** — tabel met naam, type, huidige waarde (placeholder voor nu: meest recente valuation of laatste koers × bezit), en een actie-kolom. Gebruik de shadcn `Table`-component.

**`AssetForm`** — formulier voor aanmaken/bewerken van een asset. Het type-veld (`stock_etf`, `crypto`, `savings`, `real_estate`, `pension`) bepaalt welke extra velden zichtbaar zijn (conditionele secties).

**`TransactionList`** — compacte tabel per asset: datum, type, bedrag, units (indien van toepassing), fees.

**`TransactionForm`** — formulier voor een transactie. Type-veld bepaalt welke velden relevant zijn (units/koers bij `buy`/`sell`, niet bij `deposit`/`interest`).

Kaarten, knoppen en formulierstijl conform `frontend.md`. Lege staat tonen als er nog geen assets of transacties zijn.

### 5. Asset-specifieke invoervelden per type

| Type | Extra velden |
|---|---|
| `stock_etf` | ticker, ISIN, broker, benchmark |
| `crypto` | symbol, wallet/exchange |
| `savings` | bank, account_type, interest_rate, maturity_date |
| `pension` | provider, type, pension_age |
| `real_estate` | property_type, address, purchase_date, purchase_price, purchase_costs |

Bij `real_estate` type `rental`: ook een hypotheeksectie tonen (lender, original_amount, interest_rate, start_date).

---

## Wat je NIET bouwt in deze sprint

- Rendementsberekeningen (XIRR, TWR) — Sprint 3.2
- Koersdataservice koppelen — Sprint 3.2
- CSV import — Sprint 4.1
- Dashboard en charts — Sprint 3.3
- De "huidige waarde" hoeft nog niet berekend te worden; toon een placeholder of de meest recente valuation als die er is

---

## Kritische regels

- **Geld nooit als float** — bedragen zijn `string` in TypeScript (komen als `numeric` uit Drizzle), gebruik `decimal.js` zodra je ermee rekent
- **Server Components zijn de default** — formulieren worden Client Components, lijstpagina's niet
- **Mutaties via Server Actions**, niet via fetch naar API-routes
- **Queries in `lib/db/queries/`**, nooit inline in componenten
- **`deleteAsset` is soft delete** (`is_active = false`), geen `DELETE` query
- **Geen silent failures** — finance-functies en server actions gooien bij ongeldige input een duidelijke error
- **Commit per logische stap**, imperatief Engels: `add asset CRUD`, `add transaction form`, etc.

---

## Deliverable

Een gebruiker kan na deze sprint:

1. Een nieuw asset aanmaken (elk type, met de juiste extra velden)
2. Transacties toevoegen, bewerken en verwijderen per asset
3. Zijn volledige portfolio handmatig invoeren
4. Alles terugzien in overzichtspagina's die de visuele stijl van `frontend.md` volgen
