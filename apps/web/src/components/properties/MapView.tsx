'use client'

import { MapPin, Navigation } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface MapViewProps {
  properties: any[]
}

export function MapView({ properties }: MapViewProps) {
  return (
    <div className="relative h-[600px] bg-stone-50 rounded-2xl overflow-hidden">
      {/* Map placeholder */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <div className="w-24 h-24 bg-[#E8F1F5] rounded-full flex items-center justify-center mx-auto mb-4">
            <MapPin className="w-12 h-12 text-[#1B4965]" />
          </div>
          <h3 className="text-2xl font-bold text-stone-900 mb-2">
            Interactive Map View
          </h3>
          <p className="text-stone-600 mb-6 max-w-md">
            Explore properties on an interactive map with filters and real-time updates
          </p>
          <div className="flex gap-4 justify-center">
            <Button variant="outline">
              <Navigation className="w-4 h-4 mr-2" />
              Use My Location
            </Button>
            <Button className="bg-[#1B4965] hover:bg-[#2B6985] text-white">
              Enable Map View
            </Button>
          </div>
        </div>
      </div>

      {/* Property markers preview */}
      <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-4 max-w-sm">
        <h4 className="font-semibold text-stone-900 mb-2">
          {properties.length} Properties Available
        </h4>
        <p className="text-sm text-stone-600">
          Click on markers to view property details
        </p>
      </div>

      {/* Map controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-2">
        <Button size="sm" variant="outline" className="bg-white">
          <span className="text-lg">+</span>
        </Button>
        <Button size="sm" variant="outline" className="bg-white">
          <span className="text-lg">-</span>
        </Button>
      </div>
    </div>
  )
}
