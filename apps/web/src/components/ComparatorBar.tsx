'use client'

import { useComparator } from '@/contexts/ComparatorContext'
import { useRouter } from 'next/navigation'
import { X, GitCompare, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function ComparatorBar() {
  const { items, remove, clear, count } = useComparator()
  const router = useRouter()

  if (count === 0) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#1B3A5C] text-white shadow-2xl border-t-2 border-[#C49A2E]">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center gap-4">
          {/* Label */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <GitCompare className="w-5 h-5 text-[#C49A2E]" />
            <span className="text-sm font-semibold">
              Compare <span className="text-[#C49A2E]">({count}/{4})</span>
            </span>
          </div>

          {/* Items */}
          <div className="flex-1 flex items-center gap-2 overflow-x-auto scrollbar-hide min-w-0">
            {items.map(item => (
              <div
                key={`${item.unitId}-${item.optionId}`}
                className="flex items-center gap-2 bg-white/10 hover:bg-white/20 rounded-lg px-3 py-1.5 flex-shrink-0 group transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-xs font-semibold truncate max-w-[140px]">{item.propertyTitle}</p>
                  <p className="text-xs text-white/70 truncate max-w-[140px]">
                    {item.unitName} · {item.optionName}
                  </p>
                </div>
                <button
                  onClick={() => remove(item.unitId, item.optionId)}
                  className="ml-1 text-white/50 hover:text-white transition-colors flex-shrink-0"
                  aria-label="Remove from comparison"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              size="sm"
              variant="ghost"
              onClick={clear}
              className="text-white/60 hover:text-white hover:bg-white/10 h-8 px-2"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              disabled={count < 2}
              onClick={() => router.push('/compare')}
              className="bg-[#C49A2E] hover:bg-[#A98327] text-white h-8 px-4 font-semibold disabled:opacity-40"
            >
              Compare Now
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
