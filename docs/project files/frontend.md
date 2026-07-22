# frontend.md — Personal Finance App

Laatst bijgewerkt: 11 juni 2026
Status: definitief vastgesteld (Sprint 1.3 — aanvulling)

Dit document is de visuele en structurele specificatie voor de frontend.
Bedoeld als referentie voor Claude Code vanaf Sprint 3.3, en als leidraad
voor elke UI-beslissing daarvoor.

---

## Design filosofie

**"Calm Executive"** — het gevoel van een luxe lounge waar een financieel adviseur
alvast het belangrijkste voorwerk heeft gedaan. Niet een cockpit. Niet een spreadsheet.

De gebruiker opent de app en denkt: *ik heb controle over mijn geld.*
Niet: *ik moet mijn administratie doen.*

Vier bronnen van inspiratie, in volgorde van gewicht:
1. Apple Human Interface — witruimte, hiërarchie, precisie
2. Moderne AI-tools (Linear, Raycast) — snelheid, rust, geen overbodige chrome
3. Premium wealth management software (Wealthfront, Copilot) — vertrouwen, focus
4. Scandinavisch interieurdesign — warme neutralen, functionele schoonheid

---

## Kleurpalet

```css
/* Achtergronden */
--color-canvas:     #F7F6F3;   /* paginaachtergrond — warm, niet spierwit */
--color-card:       #FFFFFF;   /* kaarten, modals */
--color-border:     #ECEAE5;   /* kaantranden, dividers */

/* Typografie */
--color-text-primary:   #161616;   /* vrijwel zwart, niet hard */
--color-text-secondary: #6B7280;   /* labels, metadata, secondaire info */

/* Acties & statussen */
--color-sage:       #6E8F74;   /* primaire knoppen, succes, doelvoortgang */
--color-blue:       #7B92B2;   /* links, secundaire acties, grafieken */
--color-amber:      #D4A05D;   /* waarschuwingen, aandachtspunten */
--color-terracotta: #C97A6B;   /* negatief — warm, niet alarmerend */

/* Grafieken (maximaal 2 per grafiek) */
--color-chart-primary:   #6E8F74;   /* sage — hoofdlijn/hoofdwaarde */
--color-chart-secondary: #7B92B2;   /* dusty blue — benchmark/vergelijking */
```

Gebruik nooit standaard rood voor negatieve getallen. `--color-terracotta` is het maximum
aan urgentie dat deze app uitstraalt.

---

## Typografie

```css
/* Lettertype */
--font-sans: 'Inter', system-ui, sans-serif;

/* Schaal */
--text-hero:   clamp(2rem, 4vw, 3rem);    /* grote begroeting op homepage */
--text-xl:     1.5rem;                     /* sectietitels, grote KPI-waarden */
--text-lg:     1.125rem;                   /* kaartkoppen */
--text-base:   1rem;                       /* bodytekst */
--text-sm:     0.875rem;                   /* labels, metadata */
--text-xs:     0.75rem;                    /* datums, subdetails */

/* Gewichten */
--font-light:   300;   /* hero-ondertitels */
--font-normal:  400;   /* bodytekst */
--font-medium:  500;   /* labels, knoppen */
--font-semibold: 600;  /* kaartkoppen, KPI-waarden */
```

Grote bedragen tonen altijd in `--font-semibold`. Percentages en labels in
`--font-medium`. Nooit bold op bodytekst.

---

## Lay-out & structuur

### Desktop (primary)
```
┌─────────────────────────────────────────────────────┐
│  TOPBAR (64px hoog, sticky)                         │
│  Logo          Overzicht  Vermogen  Vastgoed         │
│                Cashflow              🔔  👤          │
├─────────────────────────────────────────────────────┤
│                                                     │
│  PAGINA-INHOUD (max-width: 1200px, centered)        │
│  padding: 48px 32px                                 │
│                                                     │
└─────────────────────────────────────────────────────┘
```

- Geen zijbalk. Nooit.
- Topbar is de enige navigatie.
- Paginabreedte begrensd op 1200px — op brede schermen blijft alles leesbaar en
  gefocust, geen uitgerekte tabellen die de breedte opvullen.

### Mobile (semi-ondersteund)
- Topbar klapt in op hamburger-menu onder 768px
- Kolomindelingen worden gestapeld (grid → stack)
- KPI-cards worden full-width
- Grafieken behouden hoogte, verliezen breedte

---

## Kaarten

```css
.card {
  background:    var(--color-card);
  border:        1px solid var(--color-border);
  border-radius: 24px;
  padding:       24px;
}
```

Geen schaduwen. Geen gradients op kaarten. De rand is genoeg.
Schaduwen horen in 2020 thuis.

Kaartkoppen zijn klein en secundair (`--text-sm`, `--color-text-secondary`).
De waarde is het hoofdpersonage — groot, semibold, primair.

```
┌──────────────────────────────┐
│ Netto vermogen               │  ← klein, secundair
│                              │
│ €308.100                     │  ← groot, semibold, primair
│                              │
│ ↑ €2.850 deze maand          │  ← klein, sage of terracotta
└──────────────────────────────┘
```

---

## Knoppen

```css
/* Primair — sage green */
.btn-primary {
  background:    var(--color-sage);
  color:         #FFFFFF;
  border-radius: 10px;
  padding:       10px 20px;
  font-weight:   var(--font-medium);
  font-size:     var(--text-sm);
}

/* Secundair — omlijnd */
.btn-secondary {
  background:    transparent;
  border:        1px solid var(--color-border);
  color:         var(--color-text-primary);
  border-radius: 10px;
  padding:       10px 20px;
}

/* Ghost — voor inlineacties */
.btn-ghost {
  background:    transparent;
  color:         var(--color-blue);
  padding:       4px 0;
  font-size:     var(--text-sm);
}
```

---

## Grafieken

Recharts is de bibliotheek (vastgesteld in architecture.md).

**Regels:**
- Maximaal 2 kleuren per grafiek — `--color-chart-primary` en `--color-chart-secondary`
- Dunne lijnen: `strokeWidth: 1.5` voor lijngrafieken
- Geen achtergrondvulling onder lijnen (geen `area fill`) — te druk
- Uitzondering: allocatiedonut/-balk mag vlakke segmenten hebben. Bij >2
  categorieën: tinten (opacity-varianten) van `--color-chart-primary` en
  `--color-chart-secondary`, nooit een derde/vierde hue — en nooit
  `--color-terracotta`, dat betekent overal elders "verlies" (zie
  `AllocationBreakdown.tsx`)
- Grid: alleen horizontale lijnen, lichtgrijs (`#ECEAE5`), geen verticale
- Assen: `--color-text-secondary`, klein (`--text-xs`)
- Geen legenda-box — label de lijnen direct of gebruik een tooltip
- Tooltips: wit, `border-radius: 12px`, één waarde centraal, datum klein eronder
- Veel witruimte rondom de grafiek — minimaal 24px padding

**Referenties:** Apple Health, Wealthfront, Linear.

---

## Navigatie-items & paginastructuur

### 1. Overzicht (homepage)

Vier blokken, niet meer. Volgorde is vast.

**Blok 1 — Hero**
```
Goedemorgen [naam]

Je ligt op schema voor financiële vrijheid.
Nog ongeveer 8 jaar.
```
Grote typografie (`--text-hero`), lichte ondertitel (`--font-light`).
Geen kaart eromheen — vrij op de canvas.

**Blok 2 — Belangrijkste inzicht**
Één kaart. Automatisch gegenereerd: wat veranderde er het meest
deze maand in netto vermogen, en waardoor.
Eén getal, twee bulletpoints, één ghost-knop "Bekijk details".

**Blok 3 — Actief doel**
Één kaart. Voortgangsbalk in `--color-sage`.
Bedrag + target + percentage. Geen afleidingen.

**Blok 4 — AI Coach** *(Fase 4 — placeholder in v1–3)*
Één kaart met een tekstinvoer en drie suggestieknoppen.
In v1–3: kaart is zichtbaar maar toont "Komt bron in een volgende versie."
De ruimte wordt nu al gereserveerd — geen layout-breuk bij activatie.

---

### 2. Vermogen

Primaire vraag: *wat leveren mijn beleggingen op?*

**Bovenaan: drie KPI-cards naast elkaar**
```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Totaal       │  │ Rendement    │  │ vs Benchmark │
│ vermogen     │  │ dit jaar     │  │              │
│ €53.100      │  │ +8,4%        │  │ +1,2%        │
└──────────────┘  └──────────────┘  └──────────────┘
```
(Vastgoed en pensioen staan hier niet in — die zijn in de Vastgoed-sectie
respectievelijk meegenomen in netto vermogen op Overzicht.)

**Midden: vermogensontwikkeling grafiek**
Lijndiagram, één lijn, volledige breedte. Tijdfilter: 1M / 6M / 1J / Alles.

**Onder: asset-tabel**
Compacte tabel per asset: naam, huidige waarde, inleg, rendement (XIRR), +/-.
Klikbaar per rij → detail-view van dat asset.

**Asset detail-view** (via klik of slide-over):
- Waardeverloop grafiek van dit asset
- Inleg vs. rendement opsplitsing
- Alle transacties (pagineerd)
- Cost basis (voor aandelen/crypto)

---

### 3. Vastgoed

Primaire vraag: *wat levert mijn vastgoed werkelijk op?*

**Per vastgoedobject één sectieblok.** Eigen woning en verhuurappartement
krijgen elk hun eigen kaart-cluster — ze zijn te verschillend om samen te vatten.

**Eigen woning:**
```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Woningwaarde │  │ Hypotheek    │  │ Eigen vermogen│
│ €420.000     │  │ €310.000     │  │ €110.000     │
└──────────────┘  └──────────────┘  └──────────────┘
```
LTV als voortgangsbalk (daalt is goed).

**Verhuurappartement:**
```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Netto        │  │ Cash-on-cash │  │ Totaal-      │
│ huurrendement│  │ rendement    │  │ rendement    │
│ 3,33%        │  │ 14,91%       │  │ 8,2% XIRR   │
└──────────────┘  └──────────────┘  └──────────────┘
```
Daaronder: cashflow-overzicht verhuur (huurinkomsten − kosten per maand/jaar).
LTV als voortgangsbalk.

---

### 4. Cashflow

Primaire vraag: *lig ik op koers?*

**Bovenaan: twee KPI-cards**
```
┌─────────────────────┐  ┌─────────────────────┐
│ Passief inkomen     │  │ Netto vermogen       │
│ dit jaar            │  │ groei dit jaar       │
│ €10.330             │  │ +€18.500             │
└─────────────────────┘  └─────────────────────┘
```

**Midden: passief inkomen breakdown**
Drie horizontale balken: dividend, rente, huur (netto).
Simpel, geen taartdiagram — balken zijn eerlijker voor vergelijking.

**Onder: netto vermogen tijdlijn**
Lijndiagram: vermogensontwikkeling per maand.
Tweede lijn (optioneel, `--color-chart-secondary`): doellijn naar financiële vrijheid.

---

## Lege staten & feedback

Lege pagina = uitnodiging, geen foutmelding.

```
┌──────────────────────────────────────┐
│                                      │
│   Nog geen assets toegevoegd.        │
│                                      │
│   [ Voeg je eerste asset toe ]       │
│                                      │
└──────────────────────────────────────┘
```

Laadstatus: skeleton-loaders in `--color-border`, niet spinners.
Succes-toast: subtiel, onderin, sage groen, verdwijnt na 3 seconden.
Fout-toast: terracotta, blijft staan tot weggeklikt.

---

## Illustraties & sfeer

Geen stockfoto's. Geen mensen.

Gebruik abstracte lijnillustraties als visueel accent — alleen op lege staten
en de AI Coach-kaart in Fase 4. Thema: bergen, horizon, groeiende paden.
Stijl: simpele SVG-lijnen, `--color-sage` of `--color-blue`, nooit vol ingekleurd.

---

## Wat bewust buiten scope blijft (v1–3)

| Element | Reden |
|---|---|
| Dark mode | Fase 5 — kleurpalet is dan al goed gedefinieerd |
| Animaties & transities | Pas toevoegen als de structuur stabiel is |
| Onboarding flow | Solo app — niet nodig in v1 |
| Notificaties (🔔) | Reserveer de plek in de topbar, bouw de functie in Fase 4.3 |
