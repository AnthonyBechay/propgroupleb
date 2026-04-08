'use client'

import { MapPin } from 'lucide-react'

interface MapViewProps {
  properties: any[]
}

export function MapView({ properties }: MapViewProps) {
  return (
    <div className="relative h-[400px] bg-slate-50 rounded-2xl overflow-hidden flex items-center justify-center">
      <div className="text-center px-6">
        <div className="w-16 h-16 bg-[#E0EDF7] rounded-full flex items-center justify-center mx-auto mb-4">
          <MapPin className="w-8 h-8 text-[#1B3A5C]" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-2">
          Map View Coming Soon
        </h3>
        <p className="text-sm text-slate-600 max-w-md">
          We&apos;re building an interactive map so you can explore {properties.length} properties by location.
        </p>
      </div>
    </div>
  )
}
