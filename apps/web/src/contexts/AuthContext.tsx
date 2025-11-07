'use client'

import { createContext, useContext, useEffect, useState } from 'react'
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Get initial user session - optimized with timeout to prevent hanging
    const getInitialUser = async () => {
      try {
        // Add timeout to prevent hanging
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), 5000)
        )
        
        const responsePromise = apiClient.getCurrentUser() as Promise<ApiResponse<User>>
        
        const response = await Promise.race([responsePromise, timeoutPromise]) as ApiResponse<User>
        
        if (response && response.success) {
          setUser(response.data)
          setError(null)
        } else {
          setUser(null)
          setError(null)
        }
      } catch (err) {
        // Silently fail for initial auth check - user might not be logged in
        setUser(null)
        setError(null)
      } finally {
        setLoading(false)
      }
    }

    getInitialUser()
  }, [])

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await apiClient.login(email, password) as ApiResponse<User>
      
      if (response.success) {
        setUser(response.data)
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
      
      if (response.success) {
        setUser(response.data)
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
      
      if (response.success) {
        setUser(response.data)
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
      if (response.success) {
        setUser(response.data)
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