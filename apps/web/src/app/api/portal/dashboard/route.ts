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
    // Verify authentication
    const authResult = await verifyAuth(request)
    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json(
        { error: 'Unauthorized - Please sign in to view your dashboard' },
        { status: 401 }
      )
    }

    const userId = authResult.user.id

    // Fetch real data from database
    const [
      totalProperties,
      totalFavorites,
      totalInquiries,
      recentProperties,
      marketTrends,
      recentFavorites,
      recentInquiries
    ] = await Promise.all([
      prisma.property.count(),
      prisma.favoriteProperty.count({ where: { userId } }),
      prisma.propertyInquiry.count({ where: { userId } }),
      prisma.property.findMany({
        take: 3,
        orderBy: { createdAt: 'desc' },
        include: {
          developer: true,
          investmentData: true
        }
      }),
      // Calculate market trends from actual data
      prisma.property.groupBy({
        by: ['country'],
        _avg: {
          price: true
        },
        _count: {
          id: true
        }
      }),
      // Recent favorites for this user
      prisma.favoriteProperty.findMany({
        where: { userId },
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          property: {
            select: { title: true }
          }
        }
      }),
      // Recent inquiries for this user
      prisma.propertyInquiry.findMany({
        where: { userId },
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          propertyTitle: true,
          createdAt: true,
          property: { select: { title: true } }
        }
      })
    ])

    // Build real recent activity from favorites and inquiries
    const recentActivity = [
      ...recentFavorites.map((fav: any) => ({
        id: fav.id,
        type: 'favorite' as const,
        property: fav.property.title,
        date: timeAgo(new Date(fav.createdAt)),
        timestamp: new Date(fav.createdAt).getTime()
      })),
      ...recentInquiries.map((inq: any) => ({
        id: inq.id,
        type: 'inquiry' as const,
        property: inq.property?.title || inq.propertyTitle || 'Deleted Property',
        date: timeAgo(new Date(inq.createdAt)),
        timestamp: new Date(inq.createdAt).getTime()
      }))
    ]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10)
      .map(({ timestamp, ...rest }) => rest)

    // Calculate portfolio stats
    const userProperties = await prisma.property.findMany({
      where: {},
      include: {
        investmentData: true
      }
    })

    const portfolioStats = {
      totalInvestment: userProperties.reduce((sum: number, prop: any) => sum + (prop.price || 0), 0),
      totalProperties: userProperties.length,
      averageROI: userProperties.length > 0
        ? userProperties.reduce((sum: number, prop: any) => sum + (prop.investmentData?.expectedROI || 0), 0) / userProperties.length
        : 0,
      monthlyIncome: userProperties.reduce((sum: number, prop: any) => sum + (prop.investmentData?.rentalYield || 0) * (prop.price || 0) / 100 / 12, 0),
      portfolioGrowth: 0,
      savedProperties: totalFavorites
    }

    // Format market trends
    const formattedMarketTrends = marketTrends.map((trend: any) => ({
      country: trend.country,
      trend: 'stable' as const,
      value: 0,
      avgPrice: trend._avg.price || 0,
      propertyCount: trend._count.id
    }))

    return NextResponse.json({
      portfolioStats,
      recentActivity,
      marketTrends: formattedMarketTrends,
      recentProperties,
    })
  } catch (error) {
    console.error('Error fetching portal dashboard data:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
