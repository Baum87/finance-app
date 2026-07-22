# todoXlsxImport.md — Transacties importeren via xlsx

> Status: **~60% af** — werkend voor de kernflow, maar een concrete melding van de
> gebruiker ("het gaat nog niet helemaal goed") is nog niet volledig uitgezocht.
> Gepauzeerd om eerst een paar kleinere dingen op te pakken. Dit bestand is het
> vertrekpunt voor de volgende sessie.

---

## Doel van de feature

Transacties van een broker (te beginnen met Degiro) inladen via een `.xlsx`-export,
i.p.v. elke transactie handmatig invoeren. Bestaande posities worden gematcht op
ISIN; onbekende ISIN's krijgen een tickersuggestie en worden als nieuwe positie
aangemaakt. Herupload van (een deel van) hetzelfde bestand mag nooit tot dubbele
transacties leiden.

Voorbeeldbestanden: `docs/Transactions VB - Degiro.xlsx` (1 rij, voor snel testen)
en `docs/Transactions.xlsx` (volledig exportbestand, 162 rijen / 52 ISIN's).

---

## Wat is gebouwd

### Datamodel
- **Migratie 0007** (`drizzle/migrations/0007_add_transaction_external_ref.sql`):
  `transactions.external_ref` (nullable text) + unique constraint
  `transactions_asset_external_ref_unique` op `(asset_id, external_ref)`.
  **Toegepast in Supabase, geverifieerd aanwezig.**

### Parsing — `src/lib/services/import/`
- `types.ts` — canoniek `ParsedTransactionRow`-type + `BrokerFileParser`-interface.
- `brokers/degiro.ts` — Degiro-kolommapping. Zoekt kopteksten op naam, niet op
  vaste positie (zie bugs hieronder voor waarom dat nodig bleek).
- `brokers/index.ts` — registry, klaar voor een tweede broker-formaat.
- `parse.ts` — leest `.xlsx` via `exceljs`, zet elke rij om naar een generieke
  grid (`RawGrid`), herkent het broker-formaat, parset.

### Data-access
- `queries/assets.ts`: `findStockEtfAssetsByIsins` — matcht ISIN's tegen
  bestaande actieve stock_etf-posities van de tenant.
- `queries/transactions.ts`: `importTransactions` — bulk-insert met
  `ON CONFLICT (asset_id, external_ref) DO NOTHING` voor dedup.
- `services/prices.ts`: `suggestTicker` — best-effort Yahoo Finance search
  (ISIN → productnaam) voor nieuwe posities zonder ticker in het bronbestand.

### UI-flow
- Broker-detailpagina: knop **"+ Transacties importeren"**.
- `PortfolioOverview.tsx`: sectie **"Brokers zonder posities"** — brokers zonder
  posities waren anders nergens klikbaar/bereikbaar (zie bugs).
- `PortfolioGroupTable.tsx`: groep-header is zowel klikbaar naar de broker-pagina
  (stretched-link patroon) als voorzien van een losse "Transacties importeren"-link
  (kon niet genest worden in de bestaande `<a>`, vandaar de stretched-link aanpak).
- `src/app/portfolio/aandelen-etf/broker/[id]/import/`: upload → review-scherm
  (bestaande posities gegroepeerd + som, nieuwe posities met bewerkbaar
  tickerveld, waarschuwingen voor overgeslagen rijen) → bevestigen →
  resultaatsamenvatting (aantallen: geïmporteerd / duplicaten / nieuwe
  posities / overgeslagen).

---

## Bugs gevonden én opgelost tijdens testen

1. **Dev-server cache-corruptie** — per ongeluk een 2e `next dev` gestart in
   dezelfde map naast de al lopende server → "Jest worker encountered N child
   process exceptions". Geen codebug; opgelost door het dubbele proces te
   stoppen en `.next` te legen. **Let op voor volgende sessie:** niet nogmaals
   `npm run dev` starten als er al een instantie draait — eerst checken.

2. **Kolomherkenning Degiro (kritiek, gefixt)** — de headerrij gebruikt
   samengevoegde cellen (bv. "Koers" spant 2 kolommen); exceljs dupliceert de
   kopnaam naar beide kolommen. De kolomindex-map liet de latere (verkeerde)
   kolom de eerste overschrijven, waardoor "Koers" naar de EUR-valutakolom
   wees i.p.v. de prijskolom → valse "Geen geldige koers"-waarschuwingen.
   Fix: eerste voorkomen wint in de header-map (`brokers/degiro.ts`).
   Bijzonder geval: "Order ID" moet juist de kolom **na** de koptekst lezen
   (Degiro zet de echte UUID daar, niet onder de koptekst zelf) — met fallback
   naar de kopkolom zelf als een toekomstige export dit niet meer samenvoegt.

3. **Rich-text celwaarden (kritiek, gefixt)** — het volledige exportbestand
   (`Transactions.xlsx`, in tegenstelling tot het 1-rij testbestand) slaat
   tekstcellen op als `{richText:[{text:...}]}` i.p.v. platte strings, zelfs
   zonder opmaak. `worksheetToGrid` herkende dit format niet → geen enkele
   koptekst werd als string gelezen → "Bestandsformaat niet herkend". Fix:
   richText-runs samenvoegen tot platte string in `parse.ts`.

4. **Navigatiegat: lege brokers onbereikbaar (gefixt)** — `PortfolioGroupTable`
   groepeert op basis van bestaande assets; een broker zonder posities had
   dus nergens een klikbare ingang, en dus ook geen toegang tot de nieuwe
   importknop. Opgelost met de "Brokers zonder posities"-sectie.

5. **UI-iteraties op vraag van gebruiker** — actielinks in "Brokers zonder
   posities" verwijderd t.g.v. hele-rij-klikbaar; groep-header in de
   hoofdtabel herzien zodat zowel de hele-rij-navigatie als een losse
   "Transacties importeren"-link werken zonder geneste `<a>`-tags
   (stretched-link patroon, zie `PortfolioGroupTable.tsx`).

Na fix 2 en 3: volledig bestand (`Transactions.xlsx`) parset zonder
waarschuwingen — 162 rijen, 52 unieke ISIN's, geverifieerd met een los
debug-script tegen het echte bestand.

---

## Openstaand — hier verdergaan

- **Belangrijkst:** gebruiker meldde bij de eerste volledige import "5
  duplicaten, 3 overgeslagen (geen ticker)" en gaf daarna aan "het gaat nog
  niet helemaal goed" — **zonder verder te specificeren wat er precies mis
  ging.** De mechanismes zelf (Order-ID-dedup, leeg tickerveld = positie
  overslaan) zijn uitgelegd en lijken naar behoren te werken, maar er is
  geen bevestiging dat de daadwerkelijk geïmporteerde transacties (bedragen,
  buy/sell-richting, gekoppelde positie) klopten. **Eerste actie volgende
  sessie: vragen wat er concreet nog fout ging.**
- Resultaatscherm toont alleen aantallen (`skippedPositions`, `duplicates`),
  niet **welke** ISIN's/producten zijn overgeslagen of als duplicaat
  aangemerkt. Voorgesteld aan gebruiker om dit uit te breiden zodat je niet
  blind het hele bestand opnieuw hoeft door te spitten — nog niet gebouwd,
  wachtte op bevestiging.
  - Als dit gebouwd wordt: `ConfirmImportResult` in
    `broker/[id]/import/actions.ts` uitbreiden met arrays (isin/product) i.p.v.
    alleen counts; `ImportTransactionsForm.tsx` moet die dan tonen.
- Nog niet expliciet geverifieerd: sell-transacties in het echte bestand
  (bv. CLIQ DIGITAL AG: rij 3 is een buy van 60 stuks, rij 4 direct een sell
  van diezelfde 60 stuks, zelfde Order ID) — geen bevestiging dat bedrag/teken
  en de resulterende `quantityHeld`/gerealiseerd resultaat kloppen ná import.
  Waard om na de volgende importpoging te controleren op de positie-detailpagina.
- Geen "broker wijzigen/hernoemen"-feature — bestond al niet, apart
  besproken, gebruiker heeft nog niet aangegeven of dit gewenst is.
- Niet getest: dezelfde volledige lijst een tweede keer volledig opnieuw
  uploaden om te bevestigen dat dan alles (alle 162 rijen) als duplicaat
  wordt herkend zonder nieuwe posities/transacties.

---

## Health-check (laatst gedraaid)

- `npx tsc --noEmit` — schoon
- `npx eslint` op alle gewijzigde/nieuwe bestanden — schoon (alleen
  pre-existing warnings elders, niet door deze feature veroorzaakt)
- `npm test` — 63/63 groen
- `exceljs`-dependency introduceert een moderate npm-audit-finding via zijn
  gepinde `uuid@8.3.0`-afhankelijkheid (missing buffer bounds check bij
  gebruik met een `buf`-argument). Geverifieerd dat exceljs `uuid.v4()` altijd
  zonder argumenten aanroept (`node_modules/exceljs/lib/xlsx/xform/sheet/cf-ext/cf-rule-ext-xform.js`)
  — het kwetsbare pad wordt in de praktijk niet geraakt. Bewuste keuze, geen
  actie vereist tenzij exceljs zelf een fix uitbrengt.

---

## Relevante bestanden (voor snelle re-oriëntatie)

```
drizzle/migrations/0007_add_transaction_external_ref.sql
src/lib/services/import/types.ts
src/lib/services/import/parse.ts
src/lib/services/import/brokers/degiro.ts
src/lib/services/import/brokers/index.ts
src/lib/services/prices.ts                    (suggestTicker toegevoegd)
src/lib/db/queries/assets.ts                  (findStockEtfAssetsByIsins toegevoegd)
src/lib/db/queries/transactions.ts            (importTransactions toegevoegd)
src/app/portfolio/aandelen-etf/broker/[id]/import/actions.ts
src/app/portfolio/aandelen-etf/broker/[id]/import/page.tsx
src/components/portfolio/ImportTransactionsForm.tsx
src/app/portfolio/aandelen-etf/broker/[id]/page.tsx   (importknop toegevoegd)
src/components/portfolio/PortfolioOverview.tsx        ("Brokers zonder posities")
src/components/portfolio/PortfolioGroupTable.tsx      (stretched-link + importlink)
```
