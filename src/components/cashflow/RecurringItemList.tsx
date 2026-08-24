'use client'

import Decimal from 'decimal.js'
import { useSortable } from '@/lib/utils/use-sortable'
import { SortableHeader } from '@/components/ui/SortableHeader'
import { RecurringItemRow } from './RecurringItemRow'
import { ITEM_TYPE_LABELS, CATEGORY_LABELS, FREQUENCY_LABELS } from './recurring-item-labels'
import type { RecurringItem } from '@/lib/db/queries/recurring-items'

type SortKey = 'name' | 'itemType' | 'category' | 'frequency' | 'amount'

interface RecurringItemListProps {
  items: RecurringItem[]
  updateAction: (formData: FormData) => Promise<void>
  deleteAction: (formData: FormData) => Promise<void>
}

export function RecurringItemList({ items, updateAction, deleteAction }: RecurringItemListProps) {
  const { sort, toggle, sorted } = useSortable<SortKey>('name', 'asc')

  const data = sorted(items, (key, item) => {
    if (key === 'name')     return item.name
    if (key === 'itemType') return ITEM_TYPE_LABELS[item.itemType] ?? item.itemType
    if (key === 'category') return CATEGORY_LABELS[item.category] ?? item.category
    if (key === 'frequency') return FREQUENCY_LABELS[item.frequency] ?? item.frequency
    if (key === 'amount')   return new Decimal(item.amount).toNumber()
    return null
  })

  return (
    <div className="bg-card border border-border rounded-3xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left px-6 py-3 font-medium"><SortableHeader label="Naam" sortKey="name" sort={sort} onToggle={toggle} /></th>
            <th className="text-left px-6 py-3 font-medium"><SortableHeader label="Soort" sortKey="itemType" sort={sort} onToggle={toggle} /></th>
            <th className="text-left px-6 py-3 font-medium"><SortableHeader label="Categorie" sortKey="category" sort={sort} onToggle={toggle} /></th>
            <th className="text-left px-6 py-3 font-medium"><SortableHeader label="Frequentie" sortKey="frequency" sort={sort} onToggle={toggle} /></th>
            <th className="text-right px-6 py-3 font-medium"><SortableHeader label="Bedrag" sortKey="amount" sort={sort} onToggle={toggle} /></th>
            <th className="px-6 py-3" />
          </tr>
        </thead>
        <tbody>
          {data.map(item => (
            <RecurringItemRow
              key={item.id}
              item={item}
              updateAction={updateAction}
              deleteAction={deleteAction}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}
