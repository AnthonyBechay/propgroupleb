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
      OFF_PLAN: 'bg-blue-100 text-blue-700',
      NEW_BUILD: 'bg-emerald-100 text-emerald-700',
      RESALE: 'bg-purple-100 text-purple-700',
    }
    return styles[status] || 'bg-gray-100 text-gray-700'
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

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Property</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Price</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Location</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Details</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Engagement</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {properties.map((property) => (
              <tr key={property.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900 max-w-[200px] truncate">{property.title}</div>
                  {property.developer && (
                    <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                      <Building2 className="h-3 w-3" />
                      {property.developer.name}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className="font-semibold text-gray-900">
                    {formatCurrency(property.price, property.currency)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 text-gray-700">
                    <MapPin className="h-3.5 w-3.5 text-gray-400" />
                    {property.country.charAt(0) + property.country.slice(1).toLowerCase()}
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {property.bedrooms} bed · {property.bathrooms} bath · {property.area} m²
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatusBadge(property.status || 'NEW_BUILD')}`}>
                      {(property.status || 'NEW_BUILD').replace('_', ' ')}
                    </span>
                    {property.isGoldenVisaEligible && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700">
                        Golden Visa
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    {property.investmentData?.rentalYield ? (
                      <span className="flex items-center gap-1 text-emerald-600">
                        <TrendingUp className="h-3 w-3" />
                        {property.investmentData.rentalYield.toFixed(1)}%
                      </span>
                    ) : null}
                    <span className="flex items-center gap-1">
                      <Heart className="h-3 w-3 text-red-400" />
                      {property._count?.favoriteProperties || 0}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="h-3 w-3 text-blue-400" />
                      {property._count?.propertyInquiries || 0}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => handleView(property)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                      title="View"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleEdit(property)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                      title="Edit"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(property)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
