import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { normalizeApiUrl } from '@/lib/utils/api-url'

export interface AuthUser {
  id: string
  email: string
  role: 'USER' | 'ADMIN' | 'SUPER_ADMIN'
  isActive: boolean
  bannedAt?: Date | null
}

export interface AuthResult {
  authenticated: boolean
  user: AuthUser | null
}

/**
 * Verify authentication for API routes
 * Reads token from cookies and validates with backend
 */
export async function verifyAuth(request: NextRequest): Promise<AuthResult> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('token')?.value

    if (!token) {
      return { authenticated: false, user: null }
    }

    const backendUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL)

    const response = await fetch(`${backendUrl}/api/auth/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      return { authenticated: false, user: null }
    }

    const data = await response.json()
    return {
      authenticated: true,
      user: data.user,
    }
  } catch (error) {
    console.error('[verifyAuth] Error:', error)
    return { authenticated: false, user: null }
  }
}
