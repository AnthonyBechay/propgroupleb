'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { apiClient } from '@/lib/api/client'
import { ApiResponse, User } from '@/lib/types/api'

export interface AuthUser {
  id: string
  email: string
  role: 'USER' | 'ADMIN' | 'SUPER_ADMIN'
  isActive: boolean
  bannedAt?: Date | null
  emailVerifiedAt?: Date | null
  firstName?: string
  lastName?: string
  phone?: string
  country?: string
  investmentGoals?: string[]
  createdAt?: Date
  updatedAt?: Date
}

interface AuthContextType {
  user: AuthUser | null
  loading: boolean
  error: string | null
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string, userData?: Partial<AuthUser>) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  updateProfile: (data: Partial<AuthUser>) => Promise<{ error: string | null }>
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ error: string | null }>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

/** Map the API `User` shape to the context's `AuthUser`. */
function toAuthUser(u: User): AuthUser {
  return {
    id: u.id,
    email: u.email,
    role: u.role as 'USER' | 'ADMIN' | 'SUPER_ADMIN',
    isActive: u.isActive,
    bannedAt: undefined,
    emailVerifiedAt: undefined,
    firstName: u.firstName,
    lastName: u.lastName,
    phone: u.phone,
    country: u.country,
    investmentGoals: [],
    createdAt: u.createdAt ? new Date(u.createdAt) : undefined,
    updatedAt: u.updatedAt ? new Date(u.updatedAt) : undefined,
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Set once the user explicitly signs in/up/out. The initial /me bootstrap can
  // resolve late on a cold backend — after such an action — and must NOT clobber
  // the freshly authenticated state with a stale "logged out" result.
  const authActionTaken = useRef(false)

  useEffect(() => {
    let cancelled = false

    // Resolve the initial session. A cold backend (Render/Coolify spin-up) can
    // take well over 5s to answer /me; the old hard 5s timeout treated that as
    // "logged out", falsely bouncing authenticated admins to the login page.
    // We now retry a few times and only trust a *definitive* server response —
    // transient timeouts/network errors are retried, not treated as signed-out.
    const getInitialUser = async () => {
      const PER_ATTEMPT_MS = 12000
      const MAX_ATTEMPTS = 3

      for (let attempt = 1; attempt <= MAX_ATTEMPTS && !cancelled; attempt++) {
        let timer: ReturnType<typeof setTimeout> | undefined
        try {
          const req = apiClient.getCurrentUser() as Promise<ApiResponse<User>>
          req.catch(() => {}) // swallow a late rejection if this attempt times out first
          const response = (await Promise.race([
            req,
            new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), PER_ATTEMPT_MS) }),
          ])) as ApiResponse<User>
          clearTimeout(timer)

          if (cancelled || authActionTaken.current) { setLoading(false); return }
          // Definitive answer from the server (success:true) — trust it.
          setUser(response?.success && response.data ? toAuthUser(response.data) : null)
          setError(null)
          setLoading(false)
          return
        } catch {
          clearTimeout(timer)
          // Couldn't reach the server this time — back off and retry.
          if (attempt < MAX_ATTEMPTS && !cancelled) {
            await sleep(1500 * attempt)
            continue
          }
          // Out of retries — assume signed out but don't surface a scary error.
          if (!cancelled && !authActionTaken.current) { setUser(null); setError(null); setLoading(false) }
          else setLoading(false)
        }
      }
    }

    getInitialUser()
    return () => { cancelled = true }
  }, [])

  const signIn = async (email: string, password: string) => {
    try {
      authActionTaken.current = true
      setLoading(true)
      setError(null)
      
      const response = await apiClient.login(email, password) as ApiResponse<User>

      if (response.success && response.data) {
        setUser(toAuthUser(response.data))
        return { error: null }
      } else {
        setError(response.message || 'Login failed')
        return { error: response.message || 'Login failed' }
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Login failed'
      setError(errorMessage)
      return { error: errorMessage }
    } finally {
      setLoading(false)
    }
  }

  const signUp = async (email: string, password: string, userData?: Partial<AuthUser>) => {
    try {
      authActionTaken.current = true
      setLoading(true)
      setError(null)
      
      const response = await apiClient.register({
        email,
        password,
        firstName: userData?.firstName,
        lastName: userData?.lastName,
        phone: userData?.phone,
        country: userData?.country,
        investmentGoals: userData?.investmentGoals
      }) as ApiResponse<User>

      if (response.success && response.data) {
        setUser(toAuthUser(response.data))
        return { error: null }
      } else {
        setError(response.message || 'Registration failed')
        return { error: response.message || 'Registration failed' }
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Registration failed'
      setError(errorMessage)
      return { error: errorMessage }
    } finally {
      setLoading(false)
    }
  }

  const signOut = async () => {
    try {
      authActionTaken.current = true
      await apiClient.logout()
      setUser(null)
      setError(null)
    } catch (err) {
      // Even if sign out fails, clear the user state
      setUser(null)
      setError(null)
      console.error('Sign out error:', err)
    }
  }

  const updateProfile = async (data: Partial<AuthUser>) => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await apiClient.updateProfile({
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        country: data.country,
        investmentGoals: data.investmentGoals
      }) as ApiResponse<User>

      if (response.success && response.data) {
        setUser(toAuthUser(response.data))
        return { error: null }
      } else {
        setError(response.message || 'Profile update failed')
        return { error: response.message || 'Profile update failed' }
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Profile update failed'
      setError(errorMessage)
      return { error: errorMessage }
    } finally {
      setLoading(false)
    }
  }

  const changePassword = async (currentPassword: string, newPassword: string) => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await apiClient.changePassword({
        currentPassword,
        newPassword
      }) as ApiResponse
      
      if (response.success) {
        return { error: null }
      } else {
        setError(response.message || 'Password change failed')
        return { error: response.message || 'Password change failed' }
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Password change failed'
      setError(errorMessage)
      return { error: errorMessage }
    } finally {
      setLoading(false)
    }
  }

  const refreshUser = async () => {
    try {
      const response = await apiClient.getCurrentUser() as ApiResponse<User>
      if (response.success && response.data) {
        setUser(toAuthUser(response.data))
        setError(null)
      } else {
        setUser(null)
        setError(null)
      }
    } catch (err) {
      console.error('Refresh user error:', err)
      setUser(null)
      setError(null)
    }
  }

  const value = {
    user,
    loading,
    error,
    signIn,
    signUp,
    signOut,
    updateProfile,
    changePassword,
    refreshUser,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}