# Stack overzicht — Personal Finance App

> Beeldvorming: wat doet elke laag, en hoe praten ze met elkaar?

---

## De grote lijn

```
╔══════════════════════════════════════════════════════════════╗
║  JOUW BROWSER                                                ║
║                                                              ║
║  Client Components (React)                                   ║
║  → Recharts (grafieken)                                      ║
║  → shadcn/ui formulieren, knoppen, tabellen                  ║
║  → Tailwind CSS (visuele opmaak)                             ║
╚══════════════╦═══════════════════════════════════════════════╝
               │  HTTP (pagina's laden)
               │  Server Actions (formulieren indienen)
               ▼
╔══════════════════════════════════════════════════════════════╗
║  VERCEL — Next.js server                                     ║
║                                                              ║
║  React Server Components (RSC)                               ║
║  → Haalt data op uit de database                             ║
║  → Voert finance-berekeningen uit (lib/finance)              ║
║  → Stuurt alleen het eindresultaat naar de browser           ║
║                                                              ║
║  lib/finance  (pure TypeScript, geen framework)              ║
║  → XIRR, TWR, netto vermogen, vastgoedrendement              ║
║  → Rekent met data die RSC aanlevert                         ║
║                                                              ║
║  Drizzle ORM                                                 ║
║  → Type-safe queries naar de database                        ║
║  → Schema gedefinieerd in TypeScript (één bron van waarheid) ║
╚══════════════╦═══════════════════════════════════════════════╝
               │  SQL (via Drizzle of raw SQL voor zware queries)
               ▼
╔══════════════════════════════════════════════════════════════╗
║  SUPABASE CLOUD — PostgreSQL database                        ║
║                                                              ║
║  PostgreSQL                                                  ║
║  → Slaat alle data op: assets, transacties, vastgoed, ...    ║
║  → Bedragen als numeric(15,2) — nooit floating point         ║
║                                                              ║
║  Row Level Security (RLS)                                    ║
║  → Elke query wordt automatisch gefilterd op tenant/user     ║
║  → Jij ziet alleen jouw data, ook als de code een fout maakt ║
║                                                              ║
║  Supabase Auth                                               ║
║  → Inloggen / sessiebeheer                                   ║
║  → Bij registratie: trigger maakt automatisch tenant aan     ║
╚══════════════════════════════════════════════════════════════╝
```

---

## Elke laag uitgelegd

### Browser — wat de gebruiker ziet

De browser draait zo min mogelijk code. Alleen wat écht interactief moet zijn, wordt als JavaScript meegestuurd:

| Onderdeel | Wat het doet |
|---|---|
| **React Client Components** | Interactieve elementen: formulieren, filters, klikbare grafieken |
| **Recharts** | Tekent de grafieken (waardeverloop, allocatiedonut) |
| **shadcn/ui** | Kant-en-klare UI-componenten (tabellen, knoppen, modals, inputs). De broncode staat in jouw eigen repo — geen externe afhankelijkheid |
| **Tailwind CSS v4** | Opmaak via utility-classes direct in de HTML. Thema (kleuren, fonts) staat in één CSS-bestand |

Alles wat géén interactie nodig heeft — dashboarddata, berekende rendementen, tabellen met assets — wordt al kant-en-klaar HTML vanuit de server gestuurd. De browser rendert het alleen.

---

### Vercel — de server (Next.js)

Vercel host de Next.js-applicatie. Dit is de "hersenen" van de app.

**React Server Components (RSC)**
De default. Een Server Component draait op de server, praat met de database, en stuurt het eindresultaat als HTML naar de browser. Geen database-credentials in de browser, geen onnodige data over de lijn.

Voorbeeld: de dashboardpagina is een Server Component die assets ophaalt, XIRR berekent, en het resultaat als HTML naar de browser stuurt.

**Server Actions**
Hoe formulieren werken zonder losse API-routes. Wanneer je een asset toevoegt of een transactie invoert, stuurt het formulier de data naar een Server Action (een functie die server-side draait). Die valideert de input, schrijft naar de database, en stuurt de bijgewerkte pagina terug.

Stroom: `Formulier in browser → Server Action op Vercel → Drizzle → Supabase → terug`

**lib/finance — de rekenmotor**
Pure TypeScript-functies, geen React, geen database. Ontvangt data, geeft getallen terug. Getest tegen vaste testcases (finance-logic.md).

| Functie | Wat het berekent |
|---|---|
| `calculateXirr` | Intern rendement (primair rendementsgetal per asset) |
| `calculateTwr` | Time-weighted return (voor benchmarkvergelijking) |
| `calculateNetWorth` | Totaal netto vermogen op een peildatum |
| `calculateAllocation` | Verdeling per assettype + liquide/vastgezet |
| `calculatePassiveIncome` | Dividend + rente + huur minus kosten |
| `calculateRentalYield` | Bruto/netto huurrendement, cash-on-cash, LTV |
| `calculateCostBasis` | Gemiddelde aankoopkoers (voor aandelen/crypto) |

RSC roept deze functies aan met data uit de database. De database rekent zelf niets uit.

**Drizzle ORM**
De vertaallaag tussen TypeScript en SQL. Het schema (alle tabellen, types, relaties) staat in één TypeScript-bestand — dat is de enige bron van waarheid. Drizzle genereert de SQL-migraties daaruit.

Voor eenvoudige queries (assets ophalen, transacties opslaan) gebruikt Drizzle zijn eigen query-builder. Voor zware aggregaties (bijv. alle hypotheeksaldi per peildatum) wordt eventueel raw SQL geschreven.

---

### Supabase — de database

Supabase is een gehoste PostgreSQL-database met een aantal extra's bovenop gebakken.

**PostgreSQL**
De eigenlijke database. Alle data zit hier: assets, transacties, vastgoeddetails, hypotheken, wisselkoersen. Bedragen staan als `numeric(15,2)` opgeslagen — exact, geen afrondingsfouten.

**Row Level Security (RLS)**
Elke tabel heeft een beveiligingsregel die zegt: "je mag alleen rijen zien die bij jouw tenant horen." Dit wordt door PostgreSQL zelf afgedwongen, los van de applicatiecode. Zelfs als de code een fout heeft en probeert iemand anders' data op te halen — de database weigert het.

**Supabase Auth**
Inloggen werkt via Supabase Auth (email + wachtwoord in v1). Bij registratie vuurt een database-trigger automatisch af die:
1. Een `users`-rij aanmaakt (spiegel van het auth-account)
2. Een nieuwe `tenant` aanmaakt
3. De gebruiker koppelt als `owner` aan die tenant

Daarna werkt RLS automatisch — de gebruiker ziet alleen zijn eigen data.

**pgvector (later)**
Supabase heeft de pgvector-extensie ingebouwd. Dit is een vector-database in PostgreSQL, nodig voor de AI-inzichten in Fase 4. Staat klaar, wordt nu niet gebruikt.

---

## Communicatielijnen samengevat

| Van | Naar | Via | Richting |
|---|---|---|---|
| Browser | Next.js server | HTTP | Pagina's laden |
| Browser | Next.js server | Server Actions | Formulieren/mutaties |
| Next.js server | Supabase | Drizzle (SQL) | Data lezen |
| Next.js server | Supabase | Drizzle (SQL) | Data schrijven |
| Next.js server | lib/finance | Directe functieaanroep | Berekeningen |
| Supabase Auth | PostgreSQL | Interne trigger | Gebruiker aanmaken |
| Vercel | Browser | HTML/JS | Pagina serveren |

Er zijn **geen losse API-routes** in v1. Alles loopt via Server Components (lezen) of Server Actions (schrijven). Dit houdt de app eenvoudig en de communicatielijnen kort.

---

## Hoe een typische paginabezoek werkt

```
1. Jij navigeert naar /vermogen

2. Vercel ontvangt het verzoek
   → Next.js laadt de Server Component voor die pagina

3. Server Component vraagt data op
   → Drizzle stuurt een SQL-query naar Supabase
   → "Geef me alle assets van tenant X, met hun transacties"
   → RLS controleert: mag deze user dit zien? Ja.
   → Data komt terug als TypeScript-objecten

4. Server Component rekent
   → lib/finance.calculateXirr(transacties) → rendement
   → lib/finance.calculateNetWorth(assets) → netto vermogen

5. Server Component bouwt HTML
   → Tabel met assets en rendementen
   → KPI-cards met netto vermogen

6. Vercel stuurt die HTML naar jouw browser
   → Bijna geen JavaScript mee, alleen wat nodig is voor charts

7. Browser toont de pagina
   → Recharts tekent de grafieken client-side (heeft de ruwe datapunten nodig)
```

---

## Hoe een mutatie werkt (asset toevoegen)

```
1. Jij vult een formulier in en klikt "Opslaan"

2. Server Action wordt aangeroepen
   → Input wordt gevalideerd (Zod)
   → Drizzle schrijft een nieuwe rij in `assets`
   → Eventueel ook in `stock_etf_details` of `real_estate_details`

3. Next.js herlaadt de relevante pagina-segmenten
   → Jij ziet het nieuwe asset verschijnen, zonder full page reload
```

---

## Toekomst (nu niet actief, wel al klaar)

| Wat | Hoe voorbereid |
|---|---|
| AI-inzichten (Fase 4) | pgvector in Supabase beschikbaar; Claude API wordt toegevoegd aan de server |
| Gedeeld portfolio | `tenant_users`-tabel staat klaar; meerdere users aan één tenant koppelen = één rij toevoegen |
| Belastinginzicht box 3 | `asset_tax_metadata`-tabel + `tax_year` op transacties al aanwezig |
| Self-hosting | Alles open-source (PostgreSQL, Next.js, Drizzle); Vercel/Supabase zijn vervangbaar |
