import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { normalizeApiUrl } from '@/lib/utils/api-url'

export type UserRole = 'USER' | 'ADMIN' | 'SUPER_ADMIN'

export interface AuthUser {
  id: string
  email: string
  role: UserRole
  isActive: boolean
  bannedAt?: Date | null
  emailVerifiedAt?: Date | null
}

/**
 * Get the current authenticated user with role information from JWT token
 * Works in server components by reading cookies directly and validating via API
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('token')?.value

    if (!token) {
      return null
    }

    // Use normalizeApiUrl for consistent URL handling
    const backendUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL)

    const response = await fetch(`${backendUrl}/api/auth/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      cache: 'no-store', // Don't cache auth responses
    })

    const text = await response.text()

    if (!response.ok) {
      console.error(`[rbac] Auth check failed with status ${response.status}:`, text)
      return null
    }

    const data = JSON.parse(text)

    if (data.success && data.user) {
      return {
        id: data.user.id,
        email: data.user.email,
        role: data.user.role,
        isActive: data.user.isActive,
        bannedAt: data.user.bannedAt,
        emailVerifiedAt: data.user.emailVerifiedAt,
      }
    }

    console.error('[rbac] Response missing user data:', data)
    return null
  } catch (error: any) {
    console.error('[rbac] Error getting current user:', error.message || error)
    return null
  }
}

/**
 * Check if the current user has admin privileges
 */
export async function isAdmin(): Promise<boolean> {
  const user = await getCurrentUser()
  return user !== null && 
         (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') && 
         user.isActive && 
         !user.bannedAt
}

/**
 * Check if the current user is a super admin
 */
export async function isSuperAdmin(): Promise<boolean> {
  const user = await getCurrentUser()
  return user !== null && 
         user.role === 'SUPER_ADMIN' && 
         user.isActive && 
         !user.bannedAt
}

/**
 * Require authentication - redirects to login if not authenticated
 * Use this in server components (pages)
 */
export async function requireAuth(redirectTo: string = '/') {
  const user = await getCurrentUser()

  if (!user) {
    redirect(`/auth/login?next=${encodeURIComponent(redirectTo)}`)
  }

  if (!user.isActive || user.bannedAt) {
    redirect('/auth/banned')
  }

  return user
}

/**
 * Require admin role - redirects to unauthorized if not admin
 * Use this in server components (admin pages)
 */
export async function requireAdmin() {
  const user = await requireAuth('/admin')

  if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
    redirect('/unauthorized')
  }

  return user
}

/**
 * Require super admin role - redirects to unauthorized if not super admin
 * Use this in server components (admin pages)
 */
export async function requireSuperAdmin() {
  const user = await requireAuth('/admin')

  if (user.role !== 'SUPER_ADMIN') {
    redirect('/unauthorized')
  }

  return user
}

/**
 * Log admin action to audit log
 */
export async function logAdminAction(
  action: string,
  targetType?: string,
  targetId?: string,
  details?: any,
  request?: NextRequest
) {
  try {
    const user = await getCurrentUser()
    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
      throw new Error('Unauthorized to log admin action')
    }
    
    // The audit logging is now handled by the backend middleware
    // This function is kept for compatibility but doesn't need to do anything
    // as the backend automatically logs admin actions
  } catch (error) {
    console.error('Error logging admin action:', error)
  }
}

/**
 * Update user's last login timestamp
 */
export async function updateLastLogin(userId: string) {
  try {
    // The last login is now automatically updated by the backend
    // when users log in through the /api/auth/login endpoint
    // This function is kept for compatibility
  } catch (error) {
    console.error('Error updating last login:', error)
  }
}
