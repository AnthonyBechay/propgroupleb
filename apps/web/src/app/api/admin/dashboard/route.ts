import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth/verify'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request)
    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (authResult.user.role !== 'ADMIN' && authResult.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
    }

    const [totalBuildings, totalUsers, totalFavorites, totalInquiries, recentBuildings, recentUsers] =
      await Promise.all([
        prisma.building.count(),
        prisma.user.count(),
        prisma.favoriteProperty.count(),
        prisma.propertyInquiry.count(),
        prisma.building.findMany({
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true, title: true, city: true, mohafazat: true,
            status: true, kind: true, images: true, createdAt: true,
            _count: { select: { units: true, listings: true } },
          },
        }),
        prisma.user.findMany({ take: 5, orderBy: { createdAt: 'desc' } }),
      ])

    return NextResponse.json({
      stats: { totalBuildings, totalUsers, totalFavorites, totalInquiries },
      recentBuildings,
      recentUsers,
    })
  } catch (error) {
    console.error('Error fetching admin dashboard data:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
