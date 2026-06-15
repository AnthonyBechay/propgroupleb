'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Heart, Loader2, Search, ArrowRight } from 'lucide-react'
import { ListingCard } from '@/components/listing/ListingCard'
import { normalizeApiUrl } from '@/lib/utils/api-url'
import type { Listing } from '@/types'

export default function FavoritesPage() {
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchFavorites() {
      try {
        const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
        const res = await fetch(`${apiUrl}/api/favorites`, { credentials: 'include' })
        if (res.status === 401) {
          setError('Please sign in to view your saved properties')
          return
        }
        if (!res.ok) {
          setError('Failed to load saved properties')
          return
        }
        const json = await res.json()
        setListings((json.data ?? json) as Listing[])
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
          <Loader2 className="w-10 h-10 animate-spin text-slate-700 mx-auto mb-4" />
          <p className="text-slate-500 text-sm">Loading your saved properties…</p>
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
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Something went wrong</h2>
          <p className="text-slate-500 mb-6">{error}</p>
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 hover:text-slate-900">
            Browse properties <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-slate-900">Saved Properties</h1>
          <p className="mt-2 text-slate-500">
            {listings.length > 0
              ? `You have ${listings.length} saved ${listings.length === 1 ? 'property' : 'properties'}`
              : 'Properties you favorite will appear here'}
          </p>
        </div>

        {listings.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6">
              <Heart className="w-10 h-10 text-slate-300" />
            </div>
            <h2 className="text-2xl font-semibold text-slate-800 mb-3">No saved properties yet</h2>
            <p className="text-slate-500 max-w-md mb-8 leading-relaxed">
              When you find a property you love, click the heart icon to save it here for easy access.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition-colors"
            >
              <Search className="w-4 h-4" />
              Browse properties
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
