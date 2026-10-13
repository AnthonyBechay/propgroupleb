import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { normalizeApiUrl } from '@/lib/utils/api-url'

export interface AuthUser {
  id: string
  email: string
  role: 'USER' | 'AGENT' | 'CRM_MANAGER' | 'ADMIN' | 'SUPER_ADMIN'
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

    // The API answers { success, message, data }, so `data.user` was always
    // undefined and every caller saw an authenticated request with no user.
    //
    // /api/auth/me also answers 200 with `data: null` for an expired or forged
    // token, so "authenticated" has to mean "a user came back" rather than
    // "the request returned 200".
    const body = await response.json()
    const user = (body?.data ?? null) as AuthUser | null

    return {
      authenticated: user !== null,
      user,
    }
  } catch (error) {
    console.error('[verifyAuth] Error:', error)
    return { authenticated: false, user: null }
  }
}
