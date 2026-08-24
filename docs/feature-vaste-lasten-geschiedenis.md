# Feature: geschiedenis inzien bij vaste lasten & inkomsten

**Status:** nog niet gebouwd — richting nog te kiezen
**Sectie:** `/cashflow/vaste-lasten`

## Vraag

Kan een regel in de tabel klikbaar worden, zodat je terug kunt kijken hoe
het bedrag van een vaste last/inkomen zich over tijd heeft ontwikkeld?

## Antwoord: ja, de data staat er al

Sinds de bedraghistorie is ingevoerd (`recurring_item_amounts`, append-only,
zelfde patroon als `asset_valuations`) wordt elke bedragwijziging al apart
bewaard met een ingangsdatum. De tabel toont nu alleen het huidige bedrag
("sinds \<datum\>") — de oudere periodes bestaan al in de database, maar zijn
nergens zichtbaar. Er hoeft dus geen nieuwe data vastgelegd te worden, alleen
een view erbovenop.

## Twee opties

### 1. Rij uitklappen (inline)
Klik op een rij → eronder verschijnt een klein overzicht van eerdere
periodes (bedrag + vanaf-datum), zonder de pagina te verlaten.

- ✅ Snel te bouwen — geen nieuwe route, geen nieuwe query-laag nodig buiten
  wat er al is
- ✅ Blijft in context van de tabel
- ❌ Beperkt tot een simpele lijst, geen ruimte voor bijv. een grafiek

### 2. Eigen detailpagina
Klik op een rij → navigeert naar `/cashflow/vaste-lasten/[id]` met de
volledige geschiedenis, eventueel met een verloopgrafiek.

- ✅ Sluit aan bij hoe de rest van de app werkt (assets/posities hebben
  allemaal een `[id]`-detailpagina)
- ✅ Ruimte voor meer (grafiek, vergelijking met andere periodes)
- ❌ Meer bouwwerk: nieuwe route, nieuwe query, eigen laadstatus

## Aanbeveling

Optie 1 (inline uitklappen) — sluit aan bij hoe deze sectie tot nu toe
bewust simpel is gehouden, en is voldoende om de vraag ("in het verleden
kunnen kijken") te beantwoorden. Optie 2 is een logische vervolgstap als er
later behoefte ontstaat aan een grafiek of verdere vergelijking tussen
periodes.

## Openstaand

Welke optie bouwen we? Nog geen keuze gemaakt.
