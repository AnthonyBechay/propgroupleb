'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { ComparatorItem } from '@/lib/types/api'

const MAX_ITEMS = 4
const STORAGE_KEY = 'propgroup_comparator'

interface ComparatorContextType {
  items: ComparatorItem[]
  add: (item: ComparatorItem) => void
  remove: (unitId: string, optionId: string) => void
  has: (unitId: string, optionId: string) => boolean
  clear: () => void
  count: number
}

const ComparatorContext = createContext<ComparatorContextType | undefined>(undefined)

export function ComparatorProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ComparatorItem[]>([])

  // Hydrate from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) setItems(parsed)
      }
    } catch {
      // ignore
    }
  }, [])

  // Persist to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    } catch {
      // ignore
    }
  }, [items])

  const add = useCallback((item: ComparatorItem) => {
    setItems(prev => {
      const already = prev.some(i => i.unitId === item.unitId && i.optionId === item.optionId)
      if (already || prev.length >= MAX_ITEMS) return prev
      return [...prev, item]
    })
  }, [])

  const remove = useCallback((unitId: string, optionId: string) => {
    setItems(prev => prev.filter(i => !(i.unitId === unitId && i.optionId === optionId)))
  }, [])

  const has = useCallback((unitId: string, optionId: string) => {
    return items.some(i => i.unitId === unitId && i.optionId === optionId)
  }, [items])

  const clear = useCallback(() => setItems([]), [])

  return (
    <ComparatorContext.Provider value={{ items, add, remove, has, clear, count: items.length }}>
      {children}
    </ComparatorContext.Provider>
  )
}

export function useComparator() {
  const ctx = useContext(ComparatorContext)
  if (!ctx) throw new Error('useComparator must be used within ComparatorProvider')
  return ctx
}
