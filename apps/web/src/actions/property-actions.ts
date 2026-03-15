'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const propertySchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  price: z.number().min(0, 'Price must be positive'),
  currency: z.string().min(3, 'Currency is required'),
  propertyType: z.enum(['APARTMENT', 'VILLA', 'TOWNHOUSE', 'PENTHOUSE', 'STUDIO', 'DUPLEX', 'LAND', 'COMMERCIAL', 'OFFICE']),
  bedrooms: z.number().min(0, 'Bedrooms must be non-negative'),
  bathrooms: z.number().min(0, 'Bathrooms must be non-negative'),
  area: z.number().min(0, 'Area must be positive'),
  country: z.enum(['GEORGIA', 'CYPRUS', 'GREECE', 'LEBANON']),
  status: z.enum(['OFF_PLAN', 'NEW_BUILD', 'RESALE']),
  isGoldenVisaEligible: z.boolean(),
  developerId: z.string().optional(),
  locationGuideId: z.string().optional(),
  // Investment data
  expectedROI: z.number().optional(),
  rentalYield: z.number().optional(),
  capitalGrowth: z.number().optional(),
  minInvestment: z.number().optional(),
  maxInvestment: z.number().optional(),
  paymentPlan: z.string().optional(),
  completionDate: z.string().optional(),
  // Additional fields
  city: z.string().optional(),
  district: z.string().optional(),
  address: z.string().optional(),
  images: z.array(z.string()).optional(),
  location: z.string().optional(),
  amenities: z.string().optional(),
  nearbyFacilities: z.string().optional(),
})

export async function createProperty(data: z.infer<typeof propertySchema>) {
  try {
    // Validate the input
    const validatedData = propertySchema.parse(data)

    // Prepare property data
    const propertyData: any = {
      title: validatedData.title,
      description: validatedData.description,
      price: validatedData.price,
      currency: validatedData.currency,
      propertyType: validatedData.propertyType,
      bedrooms: validatedData.bedrooms,
      bathrooms: validatedData.bathrooms,
      area: validatedData.area,
      country: validatedData.country,
      status: validatedData.status,
      isGoldenVisaEligible: validatedData.isGoldenVisaEligible,
      availabilityStatus: 'AVAILABLE',
      visibility: 'PUBLIC',
      featured: false,
      publishedAt: new Date(),
    }

    // Add optional fields
    if (validatedData.city) propertyData.city = validatedData.city
    if (validatedData.district) propertyData.district = validatedData.district
    if (validatedData.address) propertyData.address = validatedData.address
    if (validatedData.location) propertyData.location = validatedData.location
    if (validatedData.amenities) propertyData.amenities = validatedData.amenities
    if (validatedData.nearbyFacilities) propertyData.nearbyFacilities = validatedData.nearbyFacilities
    if (validatedData.images) propertyData.images = validatedData.images
    if (validatedData.developerId) propertyData.developerId = validatedData.developerId
    if (validatedData.locationGuideId) propertyData.locationGuideId = validatedData.locationGuideId

    // Create the property using Prisma
    const property = await prisma.property.create({
      data: propertyData,
      include: {
        developer: true,
        locationGuide: true,
      }
    })

    // Create investment data if provided
    if (
      validatedData.expectedROI ||
      validatedData.rentalYield ||
      validatedData.capitalGrowth ||
      validatedData.minInvestment ||
      validatedData.maxInvestment ||
      validatedData.paymentPlan ||
      validatedData.completionDate
    ) {
      const investmentData: any = {
        propertyId: property.id,
      }

      if (validatedData.expectedROI) investmentData.expectedROI = validatedData.expectedROI
      if (validatedData.rentalYield) investmentData.rentalYield = validatedData.rentalYield
      if (validatedData.capitalGrowth) investmentData.capitalGrowth = validatedData.capitalGrowth
      if (validatedData.minInvestment) investmentData.minInvestment = validatedData.minInvestment
      if (validatedData.maxInvestment) investmentData.maxInvestment = validatedData.maxInvestment
      if (validatedData.paymentPlan) investmentData.paymentPlan = validatedData.paymentPlan
      if (validatedData.completionDate) investmentData.completionDate = new Date(validatedData.completionDate)
      if (validatedData.isGoldenVisaEligible) investmentData.isGoldenVisaEligible = validatedData.isGoldenVisaEligible

      await prisma.propertyInvestmentData.create({
        data: investmentData
      })
    }

    // Revalidate the properties page
    revalidatePath('/admin/properties')
    revalidatePath('/properties')

    return { success: true, property }
  } catch (error: any) {
    console.error('Error creating property:', error)
    throw new Error(error.message || 'Failed to create property')
  }
}

export async function updateProperty(id: string, data: Partial<z.infer<typeof propertySchema>>) {
  try {
    const validatedData = propertySchema.partial().parse(data)

    // Use backend API instead of Prisma directly (reliable in production Docker)
    const { normalizeApiUrl } = await import('@/lib/utils/api-url')
    const { cookies } = await import('next/headers')

    const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL)
    const cookieStore = await cookies()
    const token = cookieStore.get('token')?.value

    const response = await fetch(`${apiUrl}/api/properties/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(validatedData),
    })

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}))
      throw new Error(errData.message || errData.error || `Update failed (${response.status})`)
    }

    const result = await response.json()

    revalidatePath('/admin/properties')
    revalidatePath('/properties')
    revalidatePath(`/property/${id}`)

    return { success: true, property: result.data }
  } catch (error: any) {
    console.error('Error updating property:', error)
    throw new Error(error.message || 'Failed to update property')
  }
}

export async function deleteProperty(id: string) {
  try {
    // Delete related investment data first
    await prisma.propertyInvestmentData.deleteMany({
      where: { propertyId: id }
    })

    // Delete the property using Prisma
    await prisma.property.delete({
      where: { id }
    })

    revalidatePath('/admin/properties')
    revalidatePath('/properties')

    return { success: true }
  } catch (error: any) {
    console.error('Error deleting property:', error)
    throw new Error(error.message || 'Failed to delete property')
  }
}
