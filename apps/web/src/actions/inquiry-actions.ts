'use server'

import { apiClient } from '@/lib/api/client'
import { getCurrentUser } from '@/lib/auth/rbac'
import { ApiResponse, Inquiry } from '@/lib/types/api'
import { z } from 'zod'

const inquirySchema = z.object({
  propertyId: z.string(),
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  message: z.string().optional(),
})

export async function submitInquiry(data: z.infer<typeof inquirySchema>) {
  try {
    const validatedData = inquirySchema.parse(data)
    
    // Submit the inquiry using the API client
    const response = await apiClient.createInquiry(validatedData) as ApiResponse<Inquiry>

    if (response.success && response.data) {
      return {
        success: true, 
        inquiry: response.data,
        message: 'Your inquiry has been submitted successfully! We will get back to you soon.'
      }
    } else {
      return { 
        success: false, 
        error: response.message || 'Failed to submit inquiry. Please try again.' 
      }
    }
  } catch (error) {
    console.error('Error submitting inquiry:', error)
    if (error instanceof z.ZodError) {
      return { 
        success: false, 
        error: error.issues[0].message 
      }
    }
    return { 
      success: false, 
      error: 'Failed to submit inquiry. Please try again.' 
    }
  }
}

export async function getUserInquiries() {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return { success: false, error: 'You must be logged in to view inquiries' }
    }

    const response = await apiClient.getMyInquiries() as ApiResponse<Inquiry[]>
    
    if (response.success && response.data) {
      return { 
        success: true, 
        inquiries: response.data 
      }
    } else {
      return { success: false, error: response.message || 'Failed to fetch inquiries' }
    }
  } catch (error) {
    console.error('Error fetching inquiries:', error)
    return { success: false, error: 'Failed to fetch inquiries' }
  }
}

export async function getPropertyInquiries(propertyId: string) {
  try {
    const response = await apiClient.getInquiries({ propertyId }) as ApiResponse<Inquiry[]>
    
    if (response.success && response.data) {
      return { 
        success: true, 
        inquiries: response.data 
      }
    } else {
      return { success: false, error: response.message || 'Failed to fetch inquiries' }
    }
  } catch (error) {
    console.error('Error fetching property inquiries:', error)
    return { success: false, error: 'Failed to fetch inquiries' }
  }
}