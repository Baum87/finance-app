'use client'

import { useState, useMemo } from 'react'

export type SortDirection = 'asc' | 'desc'

export type SortState<K extends string> = {
  key: K
  direction: SortDirection
}

export function useSortable<K extends string>(defaultKey: K, defaultDir: SortDirection = 'desc') {
  const [sort, setSort] = useState<SortState<K>>({ key: defaultKey, direction: defaultDir })

  function toggle(key: K) {
    setSort(prev =>
      prev.key === key
        ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'desc' },
    )
  }

  function sorted<T>(items: T[], getValue: (key: K, item: T) => number | string | null): T[] {
    return [...items].sort((a, b) => {
      const av = getValue(sort.key, a) ?? ''
      const bv = getValue(sort.key, b) ?? ''
      const cmp = typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv), 'nl')
      return sort.direction === 'asc' ? cmp : -cmp
    })
  }

  return { sort, toggle, sorted }
}
