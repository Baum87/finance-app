import Decimal from 'decimal.js'
import { and, eq, desc, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { recurringItems, recurringItemAmounts } from '@/lib/db/schema'
import { getOrCreateTenant } from './tenant'

export type RecurringItemInput = {
  name: string
  itemType: 'income' | 'expense'
  category: string
  amount: string
  frequency: 'monthly' | 'four_weekly' | 'quarterly' | 'yearly'
  effectiveDate: string
  isShared: boolean
}

export async function getRecurringItems(userId: string) {
  const tenantId = await getOrCreateTenant(userId)

  const items = await db
    .select()
    .from(recurringItems)
    .where(and(eq(recurringItems.tenantId, tenantId), eq(recurringItems.isActive, true)))
    .orderBy(desc(recurringItems.createdAt))

  if (items.length === 0) return []

  const amounts = await db
    .select()
    .from(recurringItemAmounts)
    .where(inArray(recurringItemAmounts.recurringItemId, items.map(i => i.id)))
    .orderBy(desc(recurringItemAmounts.effectiveDate), desc(recurringItemAmounts.createdAt))

  // Eerste (meest recente) rij per item = het huidige bedrag.
  const currentAmountByItem = new Map<string, { amount: string; effectiveDate: string }>()
  for (const a of amounts) {
    if (!currentAmountByItem.has(a.recurringItemId)) {
      currentAmountByItem.set(a.recurringItemId, { amount: a.amount, effectiveDate: a.effectiveDate })
    }
  }

  return items.map(item => {
    const current = currentAmountByItem.get(item.id)
    if (!current) throw new Error(`Geen bedrag gevonden voor vaste last/inkomen "${item.name}"`)
    return { ...item, amount: current.amount, effectiveDate: current.effectiveDate }
  })
}

export type RecurringItem = Awaited<ReturnType<typeof getRecurringItems>>[number]

export async function createRecurringItem(userId: string, data: RecurringItemInput) {
  const tenantId = await getOrCreateTenant(userId)
  const [item] = await db
    .insert(recurringItems)
    .values({
      tenantId,
      name:      data.name,
      itemType:  data.itemType,
      category:  data.category,
      frequency: data.frequency,
      isShared:  data.isShared,
    })
    .returning()

  await db.insert(recurringItemAmounts).values({
    recurringItemId: item.id,
    amount:          data.amount,
    effectiveDate:   data.effectiveDate,
  })

  return item
}

// Werkt de naam/soort/categorie/frequentie bij. Het bedrag wordt alleen als
// nieuwe historie-rij toegevoegd als het daadwerkelijk afwijkt van het huidige
// bedrag — zo blijft de oudere periode (met haar eigen effectiveDate) intact.
export async function updateRecurringItem(userId: string, itemId: string, data: RecurringItemInput) {
  const tenantId = await getOrCreateTenant(userId)

  const [item] = await db
    .update(recurringItems)
    .set({
      name:      data.name,
      itemType:  data.itemType,
      category:  data.category,
      frequency: data.frequency,
      isShared:  data.isShared,
      updatedAt: new Date(),
    })
    .where(and(eq(recurringItems.id, itemId), eq(recurringItems.tenantId, tenantId)))
    .returning()

  if (!item) return

  const [latest] = await db
    .select()
    .from(recurringItemAmounts)
    .where(eq(recurringItemAmounts.recurringItemId, itemId))
    .orderBy(desc(recurringItemAmounts.effectiveDate), desc(recurringItemAmounts.createdAt))
    .limit(1)

  const amountChanged = !latest || !new Decimal(latest.amount).equals(new Decimal(data.amount))
  const dateChanged   = !latest || latest.effectiveDate !== data.effectiveDate
  if (!amountChanged && !dateChanged) return

  // Een latere ingangsdatum dan de huidige is een nieuwe periode: toevoegen,
  // de oudere periode blijft intact. Eenzelfde of eerdere datum kan nooit als
  // "huidig" naar boven komen (getRecurringItems pakt altijd de meest recente
  // effectiveDate) — dat is dan een correctie op de huidige periode (bedrag
  // en/of datum), geen nieuwe, dus die rij bijwerken i.p.v. een onzichtbare
  // rij toevoegen.
  if (latest && data.effectiveDate <= latest.effectiveDate) {
    await db
      .update(recurringItemAmounts)
      .set({ amount: data.amount, effectiveDate: data.effectiveDate })
      .where(eq(recurringItemAmounts.id, latest.id))
  } else {
    await db.insert(recurringItemAmounts).values({
      recurringItemId: itemId,
      amount:          data.amount,
      effectiveDate:   data.effectiveDate,
    })
  }
}

export async function deleteRecurringItem(userId: string, itemId: string) {
  const tenantId = await getOrCreateTenant(userId)
  await db
    .update(recurringItems)
    .set({ isActive: false })
    .where(and(eq(recurringItems.id, itemId), eq(recurringItems.tenantId, tenantId)))
}
