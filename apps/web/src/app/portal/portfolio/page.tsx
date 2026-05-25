import { prisma } from '@/lib/prisma'
import { PortfolioClient } from './PortfolioClient'
import { verifyAuth } from '@/lib/auth/verify'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function PortfolioPage() {
  // Note: auth is handled by the portal layout, but we still try to get the user
  // for the portfolio display. Return an empty portfolio if unauthenticated.
  let favorites: any[] = []
  try {
    const cookieStore = await cookies()
    // Build a minimal NextRequest-like object to reuse verifyAuth
    const tokenCookie = cookieStore.get('token')
    if (tokenCookie) {
      const mockReq = new Request('http://localhost', {
        headers: { Cookie: `token=${tokenCookie.value}` },
      })
      const authResult = await verifyAuth(mockReq as unknown as NextRequest)
      if (authResult.authenticated && authResult.user) {
        favorites = await prisma.favoriteProperty.findMany({
          where: { userId: authResult.user.id },
          include: {
            listing: {
              include: {
                building: { select: { id: true, title: true, city: true, mohafazat: true, images: true, status: true, kind: true } },
                unit: { select: { id: true, name: true, kind: true, bedrooms: true, areaSqm: true } },
              },
            },
            building: { select: { id: true, title: true, city: true, mohafazat: true, images: true, status: true, kind: true } },
          },
          orderBy: { createdAt: 'desc' },
        })
      }
    }
  } catch { /* layout handles auth redirect */ }

  const portfolio = favorites.map((fav: any) => {
    const listing = fav.listing
    const building = listing?.building ?? fav.building
    const title = listing?.headline ?? building?.title ?? 'Saved Property'
    const price = listing?.price ?? 0
    return {
      id: fav.id,
      customName: title,
      propertyId: listing?.id ?? fav.buildingId ?? fav.id,
      purchasePrice: price,
      currentValue: price,
      purchaseDate: new Date(fav.createdAt).toISOString().split('T')[0],
      location: [building?.city, building?.mohafazat].filter(Boolean).join(', ') || 'Lebanon',
      currentRent: 0,
      monthlyExpenses: 0,
      roi: 0,
      appreciation: 0,
      type: listing?.unit ? 'Unit' : 'Building',
      status: building?.status === 'OFF_PLAN' ? 'Under Construction' : 'Available',
    }
  })

  return <PortfolioClient initialPortfolio={portfolio} />
}
