'use client'

import { useEffect } from 'react'
import { track } from '@/lib/analytics'

/**
 * Records a `listing_view` for a specific listing when its detail page mounts.
 * Rendered (invisibly) inside the server-rendered listing page so we capture
 * the listing id that powers "top viewed listings" in the admin dashboard.
 */
export function TrackListingView({
  listingId,
  buildingId,
  unitId,
}: {
  listingId: string
  buildingId?: string
  unitId?: string
}) {
  useEffect(() => {
    track('listing_view', { listingId, buildingId, unitId })
    // Only once per mount / listing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listingId])

  return null
}
