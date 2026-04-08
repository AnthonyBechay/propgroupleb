import { prisma } from '@/lib/prisma'
import { PortfolioClient } from './PortfolioClient'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function PortfolioPage() {
  // Layout already handles authentication

  // Fetch properties for portfolio overview
  const properties = await prisma.property.findMany({
    include: {
      developer: true,
      investmentData: true
    }
  })

  // Transform properties to portfolio format
  const portfolio = properties.map(property => ({
    id: property.id,
    customName: property.title,
    propertyId: property.id,
    purchasePrice: property.price || 0,
    currentValue: property.price || 0,
    purchaseDate: property.createdAt.toISOString().split('T')[0],
    location: `${property.country}`,
    currentRent: (property.investmentData?.rentalYield || 0) * (property.price || 0) / 100 / 12,
    monthlyExpenses: 0,
    roi: property.investmentData?.expectedROI || 0,
    appreciation: 0,
    type: 'Property',
    status: property.status === 'NEW_BUILD' ? 'Under Construction' : 'Available'
  }))

  return <PortfolioClient initialPortfolio={portfolio} />
}
