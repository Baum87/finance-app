'use client'

import { useMemo, useState } from 'react'
import Decimal from 'decimal.js'
import { useSortable } from '@/lib/utils/use-sortable'
import { SortableHeader } from '@/components/ui/SortableHeader'
import { calculateRecurringTotals, type RecurringFrequency, type RecurringItemType } from '@/lib/finance'
import { formatCurrencyPrecise } from '@/lib/utils/format'
import { RecurringItemRow } from './RecurringItemRow'
import { ITEM_TYPE_LABELS, CATEGORY_LABELS, FREQUENCY_LABELS } from './recurring-item-labels'
import type { RecurringItem } from '@/lib/db/queries/recurring-items'

type SortKey = 'name' | 'itemType' | 'category' | 'frequency' | 'amount' | 'isShared'
type ItemTypeFilter = 'all' | RecurringItemType
type SharedFilter = 'all' | 'shared' | 'not_shared'

interface RecurringItemListProps {
  items: RecurringItem[]
  updateAction: (formData: FormData) => Promise<void>
  deleteAction: (formData: FormData) => Promise<void>
}

export function RecurringItemList({ items, updateAction, deleteAction }: RecurringItemListProps) {
  const { sort, toggle, sorted } = useSortable<SortKey>('name', 'asc')

  const [nameQuery, setNameQuery] = useState('')
  const [itemTypeFilter, setItemTypeFilter] = useState<ItemTypeFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [sharedFilter, setSharedFilter] = useState<SharedFilter>('all')

  const categoryOptions = useMemo(
    () => [...new Set(items.map(i => i.category))].sort((a, b) =>
      (CATEGORY_LABELS[a] ?? a).localeCompare(CATEGORY_LABELS[b] ?? b, 'nl'),
    ),
    [items],
  )

  const filtered = items.filter(item => {
    if (nameQuery.trim() !== '' && !item.name.toLowerCase().includes(nameQuery.trim().toLowerCase())) return false
    if (itemTypeFilter !== 'all' && item.itemType !== itemTypeFilter) return false
    if (categoryFilter !== 'all' && item.category !== categoryFilter) return false
    if (sharedFilter === 'shared' && !item.isShared) return false
    if (sharedFilter === 'not_shared' && item.isShared) return false
    return true
  })

  const data = sorted(filtered, (key, item) => {
    if (key === 'name')     return item.name
    if (key === 'itemType') return ITEM_TYPE_LABELS[item.itemType] ?? item.itemType
    if (key === 'category') return CATEGORY_LABELS[item.category] ?? item.category
    if (key === 'frequency') return FREQUENCY_LABELS[item.frequency] ?? item.frequency
    if (key === 'amount')   return new Decimal(item.amount).toNumber()
    if (key === 'isShared') return item.isShared ? 1 : 0
    return null
  })

  // Genormaliseerd naar per maand en gehalveerd voor gezamenlijk betaalde posten,
  // zodat het totaal consistent is met de KPI's en de "eigen aandeel"-weergave per rij.
  const totals = calculateRecurringTotals(
    filtered.map(item => ({
      itemType:  item.itemType as RecurringItemType,
      amount:    item.amount,
      frequency: item.frequency as RecurringFrequency,
      isActive:  item.isActive,
      isShared:  item.isShared,
    })),
  )
  const netMonthly = totals.netMonthlyCashflow

  return (
    <div className="bg-card border border-border rounded-3xl overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 px-6 py-4 border-b border-border">
        <input
          type="text"
          value={nameQuery}
          onChange={(e) => setNameQuery(e.target.value)}
          placeholder="Zoeken op naam..."
          className="flex-1 min-w-40 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <select
          value={itemTypeFilter}
          onChange={(e) => setItemTypeFilter(e.target.value as ItemTypeFilter)}
          className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="all">Alle soorten</option>
          {Object.entries(ITEM_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="all">Alle categorieën</option>
          {categoryOptions.map(value => (
            <option key={value} value={value}>{CATEGORY_LABELS[value] ?? value}</option>
          ))}
        </select>
        <select
          value={sharedFilter}
          onChange={(e) => setSharedFilter(e.target.value as SharedFilter)}
          className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="all">Gedeeld: alle</option>
          <option value="shared">Alleen gezamenlijk</option>
          <option value="not_shared">Alleen niet-gezamenlijk</option>
        </select>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left px-6 py-3 font-medium"><SortableHeader label="Naam" sortKey="name" sort={sort} onToggle={toggle} /></th>
            <th className="text-left px-6 py-3 font-medium"><SortableHeader label="Soort" sortKey="itemType" sort={sort} onToggle={toggle} /></th>
            <th className="text-left px-6 py-3 font-medium"><SortableHeader label="Categorie" sortKey="category" sort={sort} onToggle={toggle} /></th>
            <th className="text-left px-6 py-3 font-medium"><SortableHeader label="Frequentie" sortKey="frequency" sort={sort} onToggle={toggle} /></th>
            <th className="text-right px-6 py-3 font-medium"><SortableHeader label="Bedrag" sortKey="amount" sort={sort} onToggle={toggle} /></th>
            <th className="text-center px-6 py-3 font-medium"><SortableHeader label="Gedeeld" sortKey="isShared" sort={sort} onToggle={toggle} /></th>
            <th className="px-6 py-3" />
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-6 py-8 text-center text-sm text-muted-foreground italic">
                Geen posten gevonden voor deze filters.
              </td>
            </tr>
          ) : (
            data.map(item => (
              <RecurringItemRow
                key={item.id}
                item={item}
                updateAction={updateAction}
                deleteAction={deleteAction}
              />
            ))
          )}
        </tbody>
        <tfoot>
          <tr className="border-t border-border bg-muted/30">
            <td colSpan={4} className="px-6 py-3 text-sm font-medium text-foreground">
              Totaal per maand ({data.length} {data.length === 1 ? 'post' : 'posten'})
            </td>
            <td className={`px-6 py-3 text-right font-semibold ${netMonthly.gte(0) ? 'text-sage' : 'text-terracotta'}`}>
              {netMonthly.gte(0) ? '+' : ''}{formatCurrencyPrecise(netMonthly.toNumber())}
            </td>
            <td colSpan={2} />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
