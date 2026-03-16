'use client'

import { ArrowUpDown, TrendingUp, DollarSign, Square } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface PropertySortProps {
  value: string
  onChange: (value: string) => void
}

const sortOptions = [
  { value: 'newest', label: 'Newest First', icon: '\u{1F195}' },
  { value: 'price-asc', label: 'Price: Low to High', icon: '\u{1F4B0}' },
  { value: 'price-desc', label: 'Price: High to Low', icon: '\u{1F48E}' },
  { value: 'roi-desc', label: 'Highest ROI', icon: '\u{1F4C8}' },
  { value: 'area-desc', label: 'Largest Area', icon: '\u{1F3E0}' },
  { value: 'popular', label: 'Most Popular', icon: '\u{2B50}' },
]

export function PropertySort({ value, onChange }: PropertySortProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-stone-600 hidden sm:inline">
        Sort by:
      </span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-[200px] bg-white">
          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-stone-500" />
            <SelectValue />
          </div>
        </SelectTrigger>
        <SelectContent>
          {sortOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              <span className="flex items-center gap-2">
                <span>{option.icon}</span>
                <span>{option.label}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
