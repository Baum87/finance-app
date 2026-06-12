# Sprint 3.3 — Dashboard & charts

**Status:** Niet gestart
**Datum:** 12 juni 2026

---

## Doel

Drie primaire pagina's bouwen die de north-star-vragen van de app beantwoorden: Overzicht, Vermogen en Vastgoed. Na afloop heeft de gebruiker een werkend dashboard met echte data, grafieken en rendementscijfers.

---

## Context & referenties

Lees de volgende bestanden **voordat je begint**:

- `CLAUDE.md` — architectuurprincipes, naamgeving, conventies
- `src/lib/finance/index.ts` — alle beschikbare finance-functies (barrel export)
- `src/lib/db/queries/assets.ts` — bestaande query-functies incl. `getAssetsWithValues`, `getAssetWithCalculations`
- `src/lib/services/prices.ts` — koersdataservice (yahoo-finance2)
- `src/app/assets/page.tsx` en `src/app/assets/[id]/page.tsx` — patronen voor Server Components + KPI-cards

Het kleurpalet, typografieregels en grafiekregels staan expliciet in dit document — volg ze zonder afwijking.

---

## Design-tokens

Zet de volgende CSS-variabelen in `src/app/globals.css` als ze er nog niet instaan. **Controleer eerst** of ze al bestaan voordat je ze toevoegt.

```css
:root {
  /* Achtergronden */
  --color-canvas:     #F7F6F3;
  --color-card:       #FFFFFF;
  --color-border:     #ECEAE5;

  /* Typografie */
  --color-text-primary:   #161616;
  --color-text-secondary: #6B7280;

  /* Acties & statussen */
  --color-sage:       #6E8F74;
  --color-blue:       #7B92B2;
  --color-amber:      #D4A05D;
  --color-terracotta: #C97A6B;

  /* Grafieken */
  --color-chart-primary:   #6E8F74;
  --color-chart-secondary: #7B92B2;
}
```

Gebruik deze variabelen in alle nieuwe componenten. Geen hardcoded hex-waarden.

---

## Grafiek-regels (strikt volgen)

Alle grafieken gebruiken Recharts (`recharts` is al geïnstalleerd).

- `strokeWidth: 1.5` op alle lijngrafieken
- Geen `<Area>` of area fill — alleen `<Line>`
- Uitzondering: allocatiedonut gebruikt `<PieChart>` met vlakke segmenten
- Grid: alleen horizontale lijnen via `<CartesianGrid vertical={false} stroke="#ECEAE5" strokeDasharray="0" />`
- Assen: `tick={{ fill: '#6B7280', fontSize: 12 }}`, geen border
- Geen `<Legend>` component — label lijnen via tooltip of direct
- Tooltip: `contentStyle={{ background: '#fff', borderRadius: '12px', border: '1px solid #ECEAE5' }}`
- Minimaal 24px padding rondom elke grafiek

---

## Taak 1 — Topbar & navigatie

**Bestand:** `src/components/layout/Topbar.tsx` (nieuw)

Bouw een sticky topbar (64px hoog) met:
- Links: app-naam of logo (tekst "Finance" volstaat)
- Midden: navigatielinks — Overzicht (`/`), Vermogen (`/vermogen`), Vastgoed (`/vastgoed`), Cashflow (`/cashflow` — link wel tonen, pagina nog niet)
- Rechts: 🔔 (niet-functioneel, reserveer de plek) + gebruikersinitaal of e-mail als avatar-knop met sign-out via bestaande `signOut` Server Action

Styling:
- Achtergrond: `--color-card`, border-bottom: `1px solid var(--color-border)`
- Actieve link: `--color-text-primary`, `font-weight: 500`
- Inactieve link: `--color-text-secondary`
- Gebruik Next.js `<Link>` met `usePathname()` voor actieve staat → dit component is `"use client"`

**Bestand:** `src/app/layout.tsx`

Voeg `<Topbar />` toe aan de root layout zodat hij op alle pagina's verschijnt. Verwijder eventuele bestaande navigatie-placeholder.

---

## Taak 2 — Overzicht (homepage `/`)

**Bestand:** `src/app/page.tsx`

Server Component. Haal op via bestaande queries:
- `getAssetsWithValues(userId)` voor netto vermogen en allocatie
- `calculateNetWorth(...)` voor totale netto vermogen + maandverschil

Maandverschil: vergelijk huidige netto vermogen met de waarde van exact één maand geleden. Gebruik `buildNetWorthSeries` met twee punten (vandaag en 30 dagen geleden) om dit te berekenen.

**Vier blokken, vaste volgorde:**

### Blok 1 — Hero
Geen kaart eromheen — vrij op de canvas.

```
Goedemorgen / Goedemiddag / Goedenavond [voornaam of ""]

Jouw financiële overzicht van vandaag.
```

- Tijdgebaseerde begroeting: 06:00–12:00 = Goedemorgen, 12:00–18:00 = Goedemiddag, 18:00–24:00 = Goedenavond
- Typografie: `text-4xl font-semibold` voor de begroeting, `text-lg font-light text-[--color-text-secondary]` voor de ondertitel
- Voornaam ophalen uit `auth.users` metadata indien beschikbaar; anders weglaten

### Blok 2 — Netto vermogen kaart
Één kaart met:
- Label: "Netto vermogen" (`text-sm text-[--color-text-secondary]`)
- Waarde: `€xxx.xxx` (`text-3xl font-semibold`)
- Verschil t.o.v. vorige maand: `↑ €x.xxx deze maand` in `--color-sage` bij positief, `↓ €x.xxx` in `--color-terracotta` bij negatief

### Blok 3 — Actief doel kaart
Één kaart. Doelen bestaan nog niet als data-entiteit — toon een placeholder:
- Tekst: "Stel een financieel doel in"
- Ghost-knop: "Komt in een volgende versie" (disabled)
- Voortgangsbalk: leeg (0%), kleur `--color-sage`

### Blok 4 — AI Coach kaart
Één kaart:
- Label: "AI Coach"
- Tekst: "Komt in een volgende versie."
- Subtekst: "Straks kun je hier vragen stellen over je financiën." in `--color-text-secondary`

---

## Taak 3 — Vermogen (`/vermogen`)

**Bestand:** `src/app/vermogen/page.tsx`

Server Component. Data ophalen:
- `getAssetsWithValues(userId)` — voor alle assets met waarden
- Filter op liquide assets (`is_liquid = true`) voor de KPI-card "Totaal vermogen"
- `calculateAllocation(assetsWithValues)` — voor allocatiebreakdown (later in Sprint 3.4 grafiek; hier alvast berekend maar nog niet getoond als donut — dat is Sprint 3.3 scope, zie onder)
- XIRR portfolio: bereken over alle transacties van alle actieve assets samen, sluitcashflow = som huidige waarden

### Drie KPI-cards bovenaan (grid, 3 kolommen)

| Card | Waarde | Subtext |
|---|---|---|
| Totaal vermogen | som `currentValue` van liquide assets | "Aandelen, crypto en spaargeld" |
| Rendement dit jaar | portfolio XIRR YTD als percentage | "Intern rendement 2026" |
| vs. Benchmark | hardcoded `—` of `n.v.t.` | "Benchmark-koppeling volgt in Sprint 3.4" |

YTD XIRR: cashflows van 1 januari van het huidige jaar t/m vandaag + sluitcashflow.

### Vermogensontwikkeling grafiek

**Bestand:** `src/components/vermogen/NetWorthChart.tsx` (`"use client"`)

- Gebruik `buildNetWorthSeries` om een tijdreeks te bouwen
- Tijdfilter: 1M / 6M / 1J / Alles — client-side state via `useState`
- `<LineChart>` met één `<Line>` in `--color-chart-primary`
- X-as: maand/jaar labels, Y-as: euro-bedragen (afgerond, zonder decimalen)
- Volledige breedte van de container (`width="100%"`)
- Hoogte: 280px

**Lege staat:** als er geen valuatie-data is om een tijdreeks te bouwen, toon een subtiele melding: "Voeg waarderingen toe aan je assets om het verloop te zien."

### Asset-tabel

**Bestand:** `src/components/vermogen/AssetTable.tsx`

Compacte tabel (shadcn `Table`) met kolommen:
- Naam
- Type (badge, zelfde stijl als in `AssetList`)
- Huidige waarde
- Ingelegd (`calculateNetDeposit`)
- Rendement XIRR (als percentage, twee decimalen)
- +/- (ongerealiseerde winst in euro, groen/terracotta)

Elke rij klikbaar → navigeert naar `/assets/[id]` (bestaande detailpagina). Gebruik `<Link>` op de rij of een ghost-knop "Details".

Sorteer op huidige waarde DESC als default.

Alleen actieve, liquide assets in deze tabel (vastgoed en pensioen staan op de Vastgoed-pagina).

---

## Taak 4 — Vastgoed (`/vastgoed`)

**Bestand:** `src/app/vastgoed/page.tsx`

Server Component. Data ophalen:
- `getAssetsWithValues(userId)`, filter op `type = 'real_estate'`
- Per vastgoed-asset: `getAsset(userId, assetId)` voor `real_estate_details`, `mortgages` en `mortgage_balances`
- Bereken per object: `calculateNetRentalYield`, `calculateCashOnCash`, `calculateLtv`, `calculateEquity` uit `lib/finance`

### Per vastgoedobject een sectieblok

Itereer over vastgoed-assets. Splits automatisch op `property_type`:

**`primary_residence` — Eigen woning**

Drie KPI-cards (grid 3 kolommen):
- Woningwaarde: laatste `asset_valuations.value`
- Hypotheek: laatste `mortgage_balances.balance` van actieve hypotheek
- Eigen vermogen: `calculateEquity(woningwaarde, hypotheek)`

LTV-voortgangsbalk onder de cards:
- Label: "LTV — Loan-to-Value"
- Waarde: `calculateLtv(hypotheek, woningwaarde)` als percentage
- Balk vult zich van links; lager is beter — geen kleurcodering nodig, subtiel grijs
- Subtext: "Daalt naarmate je aflost of de waarde stijgt."

**`rental` — Verhuurappartement**

Drie KPI-cards (grid 3 kolommen):
- Netto huurrendement: `calculateNetRentalYield(...)` als percentage
- Cash-on-cash rendement: `calculateCashOnCash(...)` als percentage
- Totaalrendement (XIRR): `calculateXirr(cashflows)` als percentage — cashflows opbouwen vanuit transacties van dit asset + sluitcashflow equity

Onder de cards: LTV-voortgangsbalk (zelfde als boven).

Cashflow-overzicht verhuur (tabel of gestapelde rijen):
- Kolommen: Jaar, Huurinkomsten, Kosten, Netto
- Data: groepeer `rental_income` en `cost` transacties per jaar via `calculatePassiveIncome`
- Toon laatste 3 jaar (of alle jaren als er minder zijn)

**Lege staat vastgoed:** als er geen `real_estate` assets zijn:
```
Nog geen vastgoed toegevoegd.
[ Voeg vastgoed toe → /assets/new ]
```

---

## Taak 5 — Gedeelde UI-componenten

**`src/components/ui/KpiCard.tsx`** (nieuw, tenzij al bestaat)

Herbruikbare kaart voor alle KPI-waarden:

```tsx
interface KpiCardProps {
  label: string
  value: string
  subtext?: string
  trend?: { value: string; positive: boolean }
}
```

Styling conform design-tokens:
- Card: `bg-[--color-card] border border-[--color-border] rounded-3xl p-6`
- Label: `text-sm text-[--color-text-secondary] font-medium`
- Value: `text-3xl font-semibold text-[--color-text-primary] mt-1`
- Trend positief: `--color-sage`, negatief: `--color-terracotta`

**`src/components/ui/ProgressBar.tsx`** (nieuw)

```tsx
interface ProgressBarProps {
  value: number   // 0–1 (decimaal, niet percentage)
  label?: string
  subtext?: string
}
```

Styling: `bg-[--color-border]` als track, `bg-[--color-text-secondary]` als fill, `rounded-full`, hoogte 6px.

---

## Formattering van getallen

Gebruik consistent in alle nieuwe componenten:

```ts
// Euro-bedragen
const formatCurrency = (value: number) =>
  new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value)

// Percentages (input is decimaal: 0.07 → "7,00%")
const formatPercent = (value: number) =>
  new Intl.NumberFormat('nl-NL', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
```

Zet deze functies in `src/lib/utils/format.ts` als dat bestand nog niet bestaat. Importeer ze in de componenten — geen inline Intl-aanroepen verspreid door de codebase.

---

## Wat bewust buiten scope blijft

| Onderdeel | Reden |
|---|---|
| Allocatie-donut grafiek | Volgt in Sprint 3.4 samen met de Cashflow-pagina |
| Benchmark live data | Nog geen databron — placeholder tonen |
| Asset detail slide-over | Bestaande `/assets/[id]` pagina volstaat; slide-over is UX-verbetering voor later |
| Doelen als data-entiteit | Fase 4 |
| Cashflow-pagina (`/cashflow`) | Sprint 3.4 |

---

## Bestandsoverzicht

**Nieuw:**
- `src/components/layout/Topbar.tsx`
- `src/components/ui/KpiCard.tsx`
- `src/components/ui/ProgressBar.tsx`
- `src/components/vermogen/NetWorthChart.tsx`
- `src/components/vermogen/AssetTable.tsx`
- `src/app/vermogen/page.tsx`
- `src/app/vastgoed/page.tsx`
- `src/lib/utils/format.ts` (tenzij al bestaat)

**Gewijzigd:**
- `src/app/page.tsx` — homepage herbouwen
- `src/app/layout.tsx` — Topbar toevoegen
- `src/app/globals.css` — design-tokens toevoegen indien ontbrekend

---

## Verificatie

Na afronding moet het volgende werken:

1. Navigeer naar `/` → hero-begroeting zichtbaar, netto vermogen kaart toont een getal, geen JS-errors in console
2. Navigeer naar `/vermogen` → drie KPI-cards gevuld, grafiek rendert (ook als tijdreeks leeg is — lege staat tonen), asset-tabel toont liquide assets
3. Navigeer naar `/vastgoed` → per vastgoedobject correcte rendementscijfers, LTV-balk zichtbaar
4. Topbar zichtbaar op alle drie de pagina's, actieve link visueel onderscheiden
5. Alle getallen geformateerd in nl-NL notatie (punt als duizendtaldeler, komma als decimaal)
