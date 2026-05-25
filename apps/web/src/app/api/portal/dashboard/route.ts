import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth/verify'

export const dynamic = 'force-dynamic'

function timeAgo(date: Date): string {
  const now = new Date()
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`
  const months = Math.floor(days / 30)
  return `${months} month${months === 1 ? '' : 's'} ago`
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request)
    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json(
        { error: 'Unauthorized - Please sign in to view your dashboard' },
        { status: 401 }
      )
    }

    const userId = authResult.user.id

    const [totalFavorites, totalInquiries, recentFavorites, recentInquiries, recentListings] =
      await Promise.all([
        prisma.favoriteProperty.count({ where: { userId } }),
        prisma.propertyInquiry.count({ where: { userId } }),
        prisma.favoriteProperty.findMany({
          where: { userId },
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: {
            listing: { select: { headline: true, building: { select: { title: true } } } },
            building: { select: { title: true } },
          },
        }),
        prisma.propertyInquiry.findMany({
          where: { userId },
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true, buildingTitle: true, createdAt: true,
            listing: { select: { headline: true, building: { select: { title: true } } } },
          },
        }),
        prisma.listing.findMany({
          take: 3,
          where: { status: 'ACTIVE', visibility: 'PUBLIC' },
          orderBy: { createdAt: 'desc' },
          include: {
            building: {
              select: { id: true, title: true, city: true, mohafazat: true, images: true, status: true },
            },
            unit: { select: { id: true, name: true, kind: true, bedrooms: true, areaSqm: true } },
          },
        }),
      ])

    const recentActivity = [
      ...recentFavorites.map((fav: any) => ({
        id: fav.id,
        type: 'favorite' as const,
        property: fav.listing?.headline ?? fav.listing?.building?.title ?? fav.building?.title ?? 'Property',
        date: timeAgo(new Date(fav.createdAt)),
        timestamp: new Date(fav.createdAt).getTime(),
      })),
      ...recentInquiries.map((inq: any) => ({
        id: inq.id,
        type: 'inquiry' as const,
        property: inq.listing?.headline ?? inq.listing?.building?.title ?? inq.buildingTitle ?? 'Property',
        date: timeAgo(new Date(inq.createdAt)),
        timestamp: new Date(inq.createdAt).getTime(),
      })),
    ]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10)
      .map(({ timestamp, ...rest }) => rest)

    const portfolioStats = {
      totalInvestment: 0,
      totalProperties: totalFavorites,
      averageROI: 0,
      monthlyIncome: 0,
      portfolioGrowth: 0,
      savedProperties: totalFavorites,
    }

    return NextResponse.json({
      portfolioStats,
      recentActivity,
      marketTrends: [],
      recentProperties: recentListings,
    })
  } catch (error) {
    console.error('Error fetching portal dashboard data:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
