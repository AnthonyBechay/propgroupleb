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

    // Prepare update data
    const updateData: any = {}

    if (validatedData.title) updateData.title = validatedData.title
    if (validatedData.description) updateData.description = validatedData.description
    if (validatedData.price !== undefined) updateData.price = validatedData.price
    if (validatedData.currency) updateData.currency = validatedData.currency
    if (validatedData.propertyType) updateData.propertyType = validatedData.propertyType
    if (validatedData.bedrooms !== undefined) updateData.bedrooms = validatedData.bedrooms
    if (validatedData.bathrooms !== undefined) updateData.bathrooms = validatedData.bathrooms
    if (validatedData.area !== undefined) updateData.area = validatedData.area
    if (validatedData.country) updateData.country = validatedData.country
    if (validatedData.status) updateData.status = validatedData.status
    if (validatedData.isGoldenVisaEligible !== undefined) updateData.isGoldenVisaEligible = validatedData.isGoldenVisaEligible
    if (validatedData.city) updateData.city = validatedData.city
    if (validatedData.district) updateData.district = validatedData.district
    if (validatedData.address) updateData.address = validatedData.address
    if (validatedData.location) updateData.location = validatedData.location
    if (validatedData.amenities) updateData.amenities = validatedData.amenities
    if (validatedData.nearbyFacilities) updateData.nearbyFacilities = validatedData.nearbyFacilities
    if (validatedData.images) updateData.images = validatedData.images
    if (validatedData.developerId) updateData.developerId = validatedData.developerId
    if (validatedData.locationGuideId) updateData.locationGuideId = validatedData.locationGuideId

    // Update the property using Prisma
    const property = await prisma.property.update({
      where: { id },
      data: updateData,
      include: {
        developer: true,
        locationGuide: true,
      }
    })

    revalidatePath('/admin/properties')
    revalidatePath('/properties')
    revalidatePath(`/property/${id}`)

    return { success: true, property }
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
