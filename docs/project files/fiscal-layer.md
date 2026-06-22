# Fiscale Laag — Architectuur & Ontwerp

**Doel:** de app uitbreiden van "wat heb ik en wat levert het op" naar
"wat hou ik over na belasting". Dit document is het ontwerp dat de basis vormt
voor Fase E (implementatie). Het wordt opgeslagen in `docs/` zodat Claude Code
het als contract gebruikt.

**Status:** ontwerp, juni 2026. De fiscale cijfers hieronder zijn geverifieerd
tegen Belastingdienst-bronnen per juni 2026 maar moeten **jaarlijks** opnieuw
gecontroleerd worden (zie sectie 6).

> ⚠️ Deze app geeft **geen belastingadvies**. De berekeningen zijn een schatting
> ter indicatie. Voor de daadwerkelijke aangifte geldt de Belastingdienst.
> Dit principe wordt in de UI bij elke fiscale weergave herhaald.

---

## 1. De visie in drie lagen

```
Laag 1 — Vermogen & rendement      [grotendeels gebouwd]
         "Wat heb ik, wat heeft het opgeleverd?"
         → netto vermogen, XIRR, TWR, allocatie

Laag 2 — Fiscale impact            [Fase E — dit ontwerp]
         "Wat kost het de overheid, wat hou ik over?"
         → box 3-heffing, rendement na belasting

Laag 3 — Toekomstprojectie         [Fase F — later]
         "Waar sta ik over X jaar, na belasting?"
         → verwacht rendement, FIRE, na-belasting scenario's
```

Laag 2 is de prioriteit. Laag 3 bouwt erop voort en komt later.
Maar het datamodel van Laag 2 moet Laag 3 al mogelijk maken zonder refactor.

---

## 2. Hoe box 3 werkt (kort, voor de implementatie)

Nederland belast in box 3 niet je werkelijke rendement maar een **fictief
(forfaitair) rendement** over je vermogen op peildatum **1 januari**. De systematiek:

1. Je vermogen wordt verdeeld in **drie categorieën**, elk met een eigen
   forfaitair rendementspercentage:
   - **Banktegoeden** (spaargeld, deposito's, contant geld) — laag percentage
   - **Overige bezittingen** (beleggingen, crypto, tweede woning, verhuurpand) — hoog percentage
   - **Schulden** (worden afgetrokken) — eigen percentage
2. Per categorie wordt het fictieve rendement berekend.
3. Schulden boven de **schuldendrempel** verminderen het belastbaar rendement.
4. Van de grondslag wordt het **heffingsvrij vermogen** afgetrokken.
5. Over het resterende belastbaar rendement betaal je het **box 3-tarief** (36%).

**Belangrijke regels die de app moet kennen:**

- De **eigen woning (hoofdverblijf) valt NIET in box 3** — die zit in box 1
  (eigenwoningforfait + hypotheekrenteaftrek). De hypotheek op de eigen woning
  telt dus ook niet als box 3-schuld.
- Een **verhuurd appartement / tweede woning valt WEL in box 3** als "overige
  bezitting", gewaardeerd op WOZ-waarde. De hypotheek erop is een box 3-schuld.
- **Crypto** valt onder "overige bezittingen".
- **Pensioen** (werkgeverspensioen, lijfrente) valt NIET in box 3 — dat is een
  box 1-aanspraak, belast bij uitkering.
- Er bestaat een **tegenbewijsregeling**: als je werkelijke rendement lager is
  dan het forfaitaire, betaal je over het werkelijke. v1 implementeert dit niet,
  maar het datamodel houdt ruimte.

---

## 3. Geverifieerde fiscale parameters (juni 2026)

Deze cijfers zijn de bron voor het eerste parameterbestand. Per jaar gecontroleerd.

### Belastingjaar 2025 (definitief)

| Parameter | Waarde |
|---|---|
| Box 3-tarief | 36% |
| Forfait banktegoeden | 1,44% (voorlopig) → 1,37% (definitief) |
| Forfait overige bezittingen | 5,88% |
| Forfait schulden | 2,62% (voorlopig) → 2,70% (definitief) |
| Heffingsvrij vermogen (per persoon) | € 57.684 |
| Heffingsvrij vermogen (fiscale partners) | € 115.368 |
| Schuldendrempel (per persoon) | € 3.800 |
| Schuldendrempel (fiscale partners) | € 7.600 |

### Belastingjaar 2026

| Parameter | Waarde |
|---|---|
| Box 3-tarief | 36% |
| Forfait banktegoeden | 1,28% (voorlopig — definitief begin 2027) |
| Forfait overige bezittingen | 6,00% (definitief) |
| Forfait schulden | 2,70% (voorlopig — definitief begin 2027) |
| Heffingsvrij vermogen (per persoon) | € 59.357 |
| Heffingsvrij vermogen (fiscale partners) | € 118.714 |
| Schuldendrempel (per persoon) | € 3.800 |
| Schuldendrempel (fiscale partners) | € 7.600 |

> **Let op (les voor onderhoud):** er circuleerde in 2025 een voorstel om het
> forfait overige bezittingen naar **7,78%** te verhogen en het heffingsvrij
> vermogen te verlagen naar € 51.396. Dat voorstel is **niet** doorgegaan;
> 2026 hanteert 6,00% en € 59.357. Dit is exact waarom percentages nooit
> hardcoded mogen staan en jaarlijks geverifieerd moeten worden tegen de
> definitieve Belastingdienst-publicatie — niet tegen nieuwsberichten of
> Prinsjesdag-voorstellen.

### Belangrijke transitie op de horizon

- **Vanaf 2028** (beoogd) vervangt een stelsel op basis van **werkelijk
  rendement** het forfaitaire stelsel. Het datamodel moet die omslag aankunnen.
- De **groene-beleggingsvrijstelling** wordt afgebouwd: 2026 nog € 26.715,
  2027 nog € 200, vanaf 2028 weg. (v1 negeert groene beleggingen — niet in scope,
  maar genoteerd.)

---

## 4. Datamodel-uitbreiding

### 4a. Nieuwe tabel: `tax_parameters`

Eén rij per belastingjaar. Dit is de kern van het onderhoudbare ontwerp.

```sql
-- Fiscale parameters per belastingjaar.
-- JAARLIJKS handmatig aanvullen na publicatie definitieve cijfers Belastingdienst.
-- Niet user-gebonden — gedeeld over alle tenants (landelijke regelgeving).
CREATE TABLE tax_parameters (
  tax_year                      INT PRIMARY KEY,
  box3_rate                     NUMERIC(8,6) NOT NULL,  -- 0.36 = 36%
  forfait_bank                  NUMERIC(8,6) NOT NULL,  -- banktegoeden
  forfait_investments           NUMERIC(8,6) NOT NULL,  -- overige bezittingen
  forfait_debt                  NUMERIC(8,6) NOT NULL,  -- schulden
  tax_free_allowance_single     NUMERIC(15,2) NOT NULL, -- heffingsvrij, 1 persoon
  tax_free_allowance_partners   NUMERIC(15,2) NOT NULL, -- heffingsvrij, fisc. partners
  debt_threshold_single         NUMERIC(15,2) NOT NULL, -- schuldendrempel, 1 persoon
  debt_threshold_partners       NUMERIC(15,2) NOT NULL, -- schuldendrempel, partners
  is_provisional                BOOLEAN NOT NULL DEFAULT false,
  -- true als bank/schuld-forfait nog voorlopig is (definitief volgt jaar erna)
  source_note                   TEXT,    -- bijv. "Belastingdienst, geverifieerd juni 2026"
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Geen RLS** — dit is landelijke regelgeving, geen user-data (zoals `fx_rates`).

### 4b. Uitbreiding bestaande tabel: `asset_tax_metadata`

```sql
-- Bestaat al; uitbreiden met box3_category
ALTER TABLE asset_tax_metadata
  ADD COLUMN box3_category TEXT
    CHECK (box3_category IN ('bank', 'investments', 'exempt'));

-- 'bank'        → banktegoeden-forfait (savings)
-- 'investments' → overige-bezittingen-forfait (stock_etf, crypto, verhuurd vastgoed)
-- 'exempt'      → valt niet in box 3 (eigen woning, pensioen)
```

**Mapping per asset-type (default, door de app ingevuld bij aanmaken):**

| Asset-type | box3_category | Reden |
|---|---|---|
| `savings` | `bank` | banktegoeden |
| `stock_etf` | `investments` | beleggingen |
| `crypto` | `investments` | overige bezittingen |
| `real_estate` (rental) | `investments` | tweede woning, WOZ-waarde |
| `real_estate` (primary) | `exempt` | eigen woning = box 1 |
| `pension` | `exempt` | box 1-aanspraak |

### 4c. Nieuwe tabel: `tax_profile`

```sql
CREATE TABLE tax_profile (
  tenant_id          UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  user_id            UUID NOT NULL REFERENCES users(id),
  has_fiscal_partner BOOLEAN NOT NULL DEFAULT false,
  -- bepaalt of enkele of dubbele vrijstelling/drempel geldt
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

RLS aan — dit is user-specifiek.

---

## 5. Finance-engine uitbreiding

Nieuwe functies in `src/lib/finance/`, puur TypeScript, getest tegen testcases.

### 5a. `box3.ts`

```typescript
type Box3Input = {
  bankValue: number          // som banktegoeden (savings) op peildatum
  investmentsValue: number   // som overige bezittingen (stock, crypto, verhuurd vastgoed)
  box3DebtValue: number      // box 3-schulden (hypotheek verhuurpand, NIET eigen woning)
  hasFiscalPartner: boolean
  params: TaxParameters      // uit tax_parameters voor het jaar
}

type Box3Result = {
  forfaitReturn: number      // totaal fictief rendement (€)
  taxableBase: number        // grondslag na heffingsvrij vermogen
  taxDue: number             // verschuldigde box 3-belasting (€)
  effectiveRate: number      // taxDue / (totaal box 3-vermogen) — ter info
}

function calculateBox3Tax(input: Box3Input): Box3Result
```

**Berekeningslogica (conform Belastingdienst-systematiek):**

```
forfait_bank_rendement   = bankValue        × params.forfait_bank
forfait_inv_rendement    = investmentsValue × params.forfait_investments

drempel                  = hasFiscalPartner
                             ? params.debt_threshold_partners
                             : params.debt_threshold_single
aftrekbare_schuld        = max(0, box3DebtValue − drempel)
forfait_schuld_rendement = aftrekbare_schuld × params.forfait_debt

belastbaar_rendement     = forfait_bank_rendement
                         + forfait_inv_rendement
                         − forfait_schuld_rendement

rendementsgrondslag      = bankValue + investmentsValue − box3DebtValue
heffingsvrij             = hasFiscalPartner
                             ? params.tax_free_allowance_partners
                             : params.tax_free_allowance_single
grondslag_sparen_beleg   = max(0, rendementsgrondslag − heffingsvrij)

// aandeel toepassen: belastbaar rendement × (grondslag / rendementsgrondslag)
if (rendementsgrondslag <= 0) → taxDue = 0
aandeel                  = grondslag_sparen_beleg / rendementsgrondslag
voordeel                 = belastbaar_rendement × aandeel
taxDue                   = voordeel × params.box3_rate
```

> Deze formule volgt de Belastingdienst-stappen (rendementsgrondslag, aandeel,
> heffingsvrij vermogen). Dit is de v1-benadering: één persoon of een simpele
> 50/50-partnerverdeling. Complexe partnerverdelingen vallen buiten v1.

### 5b. `after-tax-return.ts`

```typescript
// Rendement na aftrek van geschatte box 3-belasting.
function calculateAfterTaxReturn(
  grossReturn: number,       // bijv. XIRR, decimaal 0.082
  assetValue: number,        // huidige waarde asset
  attributedTax: number,     // toegerekende box 3-belasting voor dit asset (€)
): number  // netto rendement decimaal
```

De toerekening van box 3-belasting per asset is een benadering: de totale
box 3-heffing wordt naar rato van waarde verdeeld over de box 3-assets.
Dit is een schatting, geen aangifte — de UI zegt dat expliciet.

---

## 6. Jaarlijks onderhoud — het kritieke proces

### Onderhoudsroutine (elk jaar, januari)

1. **Controleer de definitieve cijfers** op belastingdienst.nl voor het nieuwe jaar:
   - Box 3-tarief
   - Forfait per categorie (bank/schuld zijn vaak pas het jaar erna definitief —
     zet `is_provisional = true` tot dan)
   - Heffingsvrij vermogen (per persoon + partners)
   - Schuldendrempel
2. **Voeg een rij toe** aan `tax_parameters` voor het nieuwe jaar.
3. **Controleer of de systematiek niet structureel gewijzigd is** — vanaf ~2028
   komt werkelijk rendement. Als de systematiek verandert, is dit een
   code-wijziging in `box3.ts`, geen parameter-update.
4. **Werk dit document bij** met de nieuwe cijfers en de verificatiedatum.

### Waarom een tabel en geen hardcoded waarden

- Een nieuw jaar = één rij toevoegen, geen code-deploy.
- Historische jaren blijven correct (rendement-na-belasting over 2024 gebruikt
  2024-parameters).
- De `is_provisional`-vlag laat de UI tonen: "schatting o.b.v. voorlopige cijfers".
- Voorkomt de val van het 7,78%-voorbeeld: nieuwskoppen ≠ definitieve wet.

### Alternatief: `config/tax-rules.ts`

Een TypeScript-bestand zou ook werken en is makkelijker te versie-beheren in git.
**Afweging:** de tabel wint omdat de berekeningen server-side draaien met
DB-toegang, en een toekomstige admin-UI de parameters kan tonen zonder code te
lezen. Een seed-bestand (`src/lib/db/seed-tax-parameters.ts`) vult de tabel bij
setup — de brondata staat daarmee óók in git.

---

## 7. UI-principes voor de fiscale laag

- **Nooit een fiscaal getal zonder disclaimer.** Elke box 3-weergave krijgt:
  "Schatting — geen belastingadvies. Werkelijke aanslag via Belastingdienst."
- **Bruto en netto naast elkaar.** Niet vervangen:
  ```
  Rendement verhuurappartement
  8,2% bruto    →    5,9% na box 3 (schatting)
  ```
- **De fiscale laag is optioneel/uitklapbaar.** Laag 1 blijft de hoofdweergave,
  laag 2 is een verdieping. Niet opdringen.
- **Eén plek voor het totaalbeeld:** een "Fiscaal"-kaart met de geschatte
  box 3-heffing voor het hele vermogen, uitgesplitst per categorie.
- **`is_provisional` zichtbaar maken:** een klein label "voorlopige cijfers"
  als de forfaits voor dat jaar nog niet definitief zijn.

---

## 8. Wat dit betekent voor de bestaande app

Ook al bouwen we Laag 2 pas in Fase E — dit moet nu kloppen:

1. **`asset_tax_metadata.box3_category` vullen bij asset-creatie.** Aanpassing
   in `createAsset` o.b.v. de mapping in 4b.
2. **Onderscheid eigen woning vs. verhuurd bewaren.** Bestaat al via
   `real_estate_details.property_type`.
3. **Box 3-schuld correct identificeren.** Alleen hypotheken op verhuurd vastgoed
   zijn box 3-schuld. De query filtert op `property_type = 'rental'`.
4. **Peildatum-logica.** Box 3 gebruikt de waarde op 1 januari. De
   box 3-berekening pakt de valuation op of vóór 1 januari van het belastingjaar.

---

## 9. Roadmap-positie

```
Fase C'  — review nieuwe formulieren          [afgerond]
Fase D   — UI review alle pagina's            [volgende]
Fase E   — Fiscale laag (dit ontwerp)
           E1: tax_parameters tabel + seed + box3.ts + tests
           E2: asset_tax_metadata vullen + box3DebtValue query
           E3: UI — fiscale sectie + bruto/netto naast elkaar
Fase F   — Toekomstprojectie
           verwacht rendement, FIRE, na-belasting scenario's
Fase G   — AI-inzichten (pas zinvol na E + F)
```

---

## 10. Documenten die bijgewerkt moeten worden

Als dit ontwerp akkoord is:
- `docs/project files/context.md` — north star aanscherpen met drie lagen + fiscale visie
- `docs/project files/data-model.md` — `tax_parameters`, `tax_profile`, `asset_tax_metadata`-uitbreiding
- `docs/project files/finance-logic.md` — `calculateBox3Tax` + `calculateAfterTaxReturn` als contract
- `docs/project files/decisions.md` — nieuwe beslissing: fiscale laag via parameter-tabel
