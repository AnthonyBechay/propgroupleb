'use client'

import { useState } from 'react'
import { ChevronDown, Calculator } from 'lucide-react'
import { RoiCalculator } from '@/components/RoiCalculator'

interface Props {
  propertyPrice: number
  estimatedRent: number
}

export function CollapsibleRoiCalculator({ propertyPrice, estimatedRent }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
            <Calculator className="w-5 h-5 text-[#1B3A5C]" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">ROI Calculator</h2>
            <p className="text-xs text-slate-500">Estimate your return on investment</p>
          </div>
        </div>
        <ChevronDown
          className={`w-5 h-5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="border-t border-slate-100">
          <RoiCalculator propertyPrice={propertyPrice} estimatedRent={estimatedRent} />
        </div>
      )}
    </div>
  )
}
