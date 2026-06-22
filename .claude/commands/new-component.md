# /new-component — Nieuw component aanmaken

Argumenten: $COMPONENT_NAME $FEATURE (bijv. `AssetCard assets`)

Stappen:
1. Maak `src/components/$FEATURE/$COMPONENT_NAME.tsx` aan
2. Bepaal: heeft dit component interactiviteit, hooks of browser-API nodig?
   - Nee → Server Component (geen directive)
   - Ja  → Client Component (`"use client"` bovenaan)
3. Gebruik shadcn/ui primitieven uit `src/components/ui/` waar van toepassing
4. Importeer `formatCurrency` / `formatPercent` uit `@/lib/utils/format` voor weergave
5. Gebruik designtokens: `--color-sage`, `--color-terracotta`, `--color-canvas`, etc.
6. Geen inline queries — data wordt als props meegegeven vanuit een Server Component
7. Exporteer als named export én als default export
