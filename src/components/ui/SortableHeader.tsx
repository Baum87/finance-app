'use client'

import type { SortState, SortDirection } from '@/lib/utils/use-sortable'

type Props<K extends string> = {
  label: string
  sortKey: K
  sort: SortState<K>
  onToggle: (key: K) => void
  className?: string
}

export function SortableHeader<K extends string>({ label, sortKey, sort, onToggle, className = '' }: Props<K>) {
  const isActive = sort.key === sortKey
  const arrow = isActive ? (sort.direction === 'asc' ? ' ↑' : ' ↓') : ''

  return (
    <button
      type="button"
      onClick={() => onToggle(sortKey)}
      className={`text-xs text-muted-foreground hover:text-foreground transition-colors select-none ${isActive ? 'text-foreground font-medium' : ''} ${className}`}
    >
      {label}{arrow}
    </button>
  )
}
