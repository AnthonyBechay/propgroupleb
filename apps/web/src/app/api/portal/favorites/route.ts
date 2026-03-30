import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth/verify'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request)
    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const favorites = await prisma.favoriteProperty.findMany({
      where: { userId: authResult.user.id },
      include: {
        property: {
          include: {
            investmentData: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const properties = favorites.map((fav: any) => ({
      ...fav.property,
      images: fav.property.images || [],
      investmentData: fav.property.investmentData
        ? {
            expectedROI: fav.property.investmentData.expectedROI,
            rentalYield: fav.property.investmentData.rentalYield,
            capitalGrowth: fav.property.investmentData.capitalGrowth,
          }
        : undefined,
    }))

    return NextResponse.json({ success: true, data: properties })
  } catch (error) {
    console.error('Error fetching favorite properties:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
