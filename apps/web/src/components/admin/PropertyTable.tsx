'use client'

import { useState } from 'react'
import { Property } from '@/lib/types/api'
import { EditPropertyModal } from './EditPropertyModal'
import {
  Edit,
  Trash2,
  Eye,
  Heart,
  MessageSquare,
  MapPin,
  Building2,
  TrendingUp,
} from 'lucide-react'

type PropertyTableProps = {
  properties: Property[]
}

export function PropertyTable({ properties }: PropertyTableProps) {
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null)
  const [editModalOpen, setEditModalOpen] = useState(false)

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      OFF_PLAN: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      NEW_BUILD: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      RESALE: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    }
    return styles[status] || 'bg-slate-500/20 text-slate-400 border-slate-500/30'
  }

  const handleEdit = (property: Property) => {
    setSelectedProperty(property)
    setEditModalOpen(true)
  }

  const handleDelete = async (property: Property) => {
    if (!confirm(`Are you sure you want to delete "${property.title}"? This action cannot be undone.`)) {
      return
    }
    try {
      const { normalizeApiUrl } = await import('@/lib/utils/api-url')
      const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
      const response = await fetch(`${apiUrl}/api/properties/${property.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (response.ok) {
        window.location.reload()
      } else {
        const error = await response.json()
        alert(`Failed to delete property: ${error.message}`)
      }
    } catch (error) {
      console.error('Error deleting property:', error)
      alert('Failed to delete property. Please try again.')
    }
  }

  const handleView = (property: Property) => {
    window.open(`/property/${property.id}`, '_blank')
  }

  return (
    <>
      <EditPropertyModal
        property={selectedProperty}
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
      />

      <div className="space-y-3">
        {properties.map((property) => (
          <div
            key={property.id}
            className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 hover:border-slate-600 transition-colors"
          >
            <div className="flex items-start justify-between gap-4">
              {/* Left: Property Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-white font-semibold truncate">{property.title}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${getStatusBadge(property.status || 'NEW_BUILD')}`}>
                    {(property.status || 'NEW_BUILD').replace('_', ' ')}
                  </span>
                  {property.isGoldenVisaEligible && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                      Golden Visa
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-4 text-sm text-slate-400">
                  <span className="text-cyan-400 font-semibold text-base">
                    {formatCurrency(property.price, property.currency)}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {property.country.charAt(0) + property.country.slice(1).toLowerCase()}
                  </span>
                  <span>
                    {property.bedrooms} bed · {property.bathrooms} bath · {property.area} m²
                  </span>
                  {property.developer && (
                    <span className="flex items-center gap-1">
                      <Building2 className="h-3.5 w-3.5" />
                      {property.developer.name}
                    </span>
                  )}
                </div>

                {/* Metrics row */}
                <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                  {property.investmentData?.rentalYield && (
                    <span className="flex items-center gap-1 text-emerald-400">
                      <TrendingUp className="h-3 w-3" />
                      {property.investmentData.rentalYield.toFixed(1)}% yield
                    </span>
                  )}
                  {property.investmentData?.expectedROI && (
                    <span className="text-blue-400">
                      {property.investmentData.expectedROI.toFixed(1)}% ROI
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Heart className="h-3 w-3 text-red-400" />
                    {property._count?.favoriteProperties || 0}
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageSquare className="h-3 w-3 text-blue-400" />
                    {property._count?.propertyInquiries || 0}
                  </span>
                </div>
              </div>

              {/* Right: Action Buttons */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  onClick={() => handleView(property)}
                  className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                  title="View"
                >
                  <Eye className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleEdit(property)}
                  className="p-2 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 transition-colors"
                  title="Edit"
                >
                  <Edit className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(property)}
                  className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
