'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useEffect, useState } from 'react'
import { PropertyCard } from '@/components/PropertyCard'
import Link from 'next/link'
import { Heart, Loader2, Search, ArrowRight } from 'lucide-react'

interface Property {
  id: string
  title: string
  description: string
  price: number
  currency: string
  bedrooms: number
  bathrooms: number
  area: number
  country: string
  status: string
  images: string[]
  isGoldenVisaEligible: boolean
  investmentData?: {
    expectedROI?: number | null
    rentalYield?: number | null
    capitalGrowth?: number | null
  }
}

export default function FavoritesPage() {
  const { user } = useAuth()
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchFavorites() {
      try {
        const response = await fetch('/api/portal/favorites', {
          credentials: 'include',
        })

        if (response.ok) {
          const result = await response.json()
          if (result.success) {
            setProperties(result.data)
          } else {
            setError(result.error || 'Failed to load favorites')
          }
        } else if (response.status === 401) {
          setError('Please sign in to view your favorites')
        } else {
          setError('Failed to load favorites')
        }
      } catch (err) {
        console.error('Error fetching favorites:', err)
        setError('An unexpected error occurred')
      } finally {
        setLoading(false)
      }
    }

    fetchFavorites()
  }, [])

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-[#1B3A5C] mx-auto mb-4" />
          <p className="text-slate-500 text-sm">Loading your favorites...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-slate-50">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Heart className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">
            Something went wrong
          </h2>
          <p className="text-slate-500 mb-6">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-slate-900">
            Saved Properties
          </h1>
          <p className="mt-2 text-slate-500">
            {properties.length > 0
              ? `You have ${properties.length} saved ${properties.length === 1 ? 'property' : 'properties'}`
              : 'Properties you favorite will appear here'}
          </p>
        </div>

        {/* Properties Grid */}
        {properties.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {properties.map((property) => (
              <PropertyCard
                key={property.id}
                id={property.id}
                title={property.title}
                description={property.description}
                price={property.price}
                currency={property.currency}
                bedrooms={property.bedrooms}
                bathrooms={property.bathrooms}
                area={property.area}
                country={property.country}
                status={property.status}
                images={property.images}
                isGoldenVisaEligible={property.isGoldenVisaEligible}
                investmentData={property.investmentData}
                isFavorited={true}
              />
            ))}
          </div>
        ) : (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6">
              <Heart className="w-10 h-10 text-slate-300" />
            </div>
            <h2 className="text-2xl font-semibold text-slate-800 mb-3">
              No saved properties yet
            </h2>
            <p className="text-slate-500 max-w-md mb-8 leading-relaxed">
              When you find a property you love, click the heart icon to save it
              here for easy access later.
            </p>
            <Link
              href="/properties"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#1B3A5C] text-white font-medium rounded-xl hover:bg-[#24507D] transition-colors shadow-md"
            >
              <Search className="w-4 h-4" />
              Browse Properties
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
