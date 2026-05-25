import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth/verify'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request)
    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const favorites = await prisma.favoriteProperty.findMany({
      where: { userId: authResult.user.id },
      include: {
        listing: {
          include: {
            building: {
              select: { id: true, title: true, city: true, mohafazat: true, images: true, status: true, kind: true },
            },
            unit: {
              select: { id: true, name: true, kind: true, bedrooms: true, areaSqm: true },
            },
          },
        },
        building: {
          select: { id: true, title: true, city: true, mohafazat: true, images: true, status: true, kind: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ success: true, data: favorites })
  } catch (error) {
    console.error('Error fetching favorites:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
