'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Building2, Loader2, Mail, Lock, Shield, Chrome } from 'lucide-react'
import Link from 'next/link'

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

type LoginData = z.infer<typeof loginSchema>

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') || '/'
  const { signIn, user, loading } = useAuth()
  
  // Track if we've already checked for redirect to prevent loops
  const [hasCheckedRedirect, setHasCheckedRedirect] = useState(false)

  const [isLoading, setIsLoading] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const form = useForm<LoginData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  // Check if already logged in - optimized to prevent unnecessary re-renders
  useEffect(() => {
    // Only check once after loading completes
    if (!loading && !hasCheckedRedirect) {
      setHasCheckedRedirect(true)
      
      if (user) {
        // Only redirect if user is active and not banned
        if (!user.isActive || user.bannedAt) {
          router.push('/auth/banned')
          return
        }

        // Redirect based on role
        if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') {
          router.push('/admin')
        } else {
          router.push(next)
        }
      }
    }
  }, [user, loading, router, next, hasCheckedRedirect])

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true)
    setError(null)

    try {
      // Get the API base URL - normalize it
      const { normalizeApiUrl } = await import('@/lib/utils/api-url')
      const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001')

      // Store the intended next page
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('auth_redirect', next)
      }

      // Redirect to Google OAuth - endpoint is /api/auth/google
      window.location.href = `${apiUrl}/api/auth/google`
    } catch (err) {
      console.error('Google login error:', err)
      setError('Failed to initiate Google login')
      setIsGoogleLoading(false)
    }
  }

  const handleLogin = async (data: LoginData) => {
    setIsLoading(true)
    setError(null)

    try {
      const { error } = await signIn(data.email, data.password)

      if (error) {
        setError(error)
        return
      }

      // The redirect will be handled by the useEffect above
    } catch (err) {
      console.error('Login error:', err)
      setError('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  // Show login form immediately, don't wait for auth check
  // This prevents the 2-minute delay issue
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0a1628] via-[#0f2439] to-[#1e293b] py-12 px-4 sm:px-6 lg:px-8">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div
          className="absolute top-0 -left-40 w-[600px] h-[600px] rounded-full opacity-15 blur-[120px]"
          style={{ background: 'radial-gradient(circle, #2563eb 0%, transparent 70%)' }}
        />
        <div
          className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full opacity-15 blur-[120px]"
          style={{ background: 'radial-gradient(circle, #8b5cf6 0%, transparent 70%)' }}
        />
      </div>

      <div className="max-w-md w-full space-y-8 relative z-10">
        <div className="bg-white shadow-2xl rounded-2xl px-8 py-10 border-2 border-slate-100">
          <div className="text-center">
            <div className="flex justify-center">
              <div className="p-3 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl shadow-lg">
                <Building2 className="h-8 w-8 text-white" />
              </div>
            </div>

            <h1 className="mt-4 text-3xl font-black text-gray-900">
              Welcome Back
            </h1>

            <p className="mt-2 text-sm text-slate-600">
              Sign in to access your account
            </p>

            {next.startsWith('/admin') && (
              <div className="mt-4 inline-flex items-center px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md">
                <Shield className="h-4 w-4 mr-2" />
                Admin Login Required
              </div>
            )}
          </div>

          {error && (
            <div className="mt-6 bg-red-50 border-2 border-red-200 text-red-800 px-4 py-3 rounded-xl flex items-center gap-2">
              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              <span className="font-medium">{error}</span>
            </div>
          )}

          {/* Google Sign In Button */}
          <div className="mt-6">
            <Button
              type="button"
              variant="outline"
              className="w-full border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 rounded-xl font-bold py-6"
              onClick={handleGoogleLogin}
              disabled={isGoogleLoading}
            >
              {isGoogleLoading ? (
                <>
                  <Loader2 className="h-5 w-5 mr-3 animate-spin" />
                  Connecting to Google...
                </>
              ) : (
                <>
                  <Chrome className="h-5 w-5 mr-3 text-blue-600" />
                  Continue with Google
                </>
              )}
            </Button>
          </div>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t-2 border-slate-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-slate-500 font-medium">Or continue with email</span>
              </div>
            </div>
          </div>

          <form onSubmit={form.handleSubmit(handleLogin)} className="mt-6 space-y-5">
            <div>
              <Label htmlFor="email" className="font-bold text-gray-900">Email Address</Label>
              <div className="mt-2 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-slate-400" />
                </div>
                <Input
                  id="email"
                  type="email"
                  {...form.register('email')}
                  placeholder="admin@example.com"
                  className="pl-10 border-2 border-slate-200 rounded-xl focus:border-cyan-500 focus:ring-cyan-500"
                  autoComplete="email"
                />
              </div>
              {form.formState.errors.email && (
                <p className="mt-1 text-xs text-red-600 font-medium">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="password" className="font-bold text-gray-900">Password</Label>
              <div className="mt-2 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-slate-400" />
                </div>
                <Input
                  id="password"
                  type="password"
                  {...form.register('password')}
                  placeholder="Enter your password"
                  className="pl-10 border-2 border-slate-200 rounded-xl focus:border-cyan-500 focus:ring-cyan-500"
                  autoComplete="current-password"
                />
              </div>
              {form.formState.errors.password && (
                <p className="mt-1 text-xs text-red-600 font-medium">
                  {form.formState.errors.password.message}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4 w-4 text-cyan-600 focus:ring-cyan-500 border-slate-300 rounded"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-slate-600">
                  Remember me
                </label>
              </div>

              <div className="text-sm">
                <Link
                  href="/auth/reset-password"
                  className="font-medium text-cyan-600 hover:text-cyan-700"
                >
                  Forgot password?
                </Link>
              </div>
            </div>

            <div className="space-y-3">
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white rounded-xl font-bold py-6 shadow-lg"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Signing In...
                  </>
                ) : (
                  'Sign In'
                )}
              </Button>
            </div>
          </form>

          <div className="mt-6 text-center">
            <Link
              href="/auth/signup"
              className="text-sm text-slate-600 hover:text-gray-900 font-medium"
            >
              Don't have an account?{' '}
              <span className="text-cyan-600 hover:text-cyan-700 font-bold">Sign up</span>
            </Link>
          </div>
        </div>

        <div className="text-center">
          <Link href="/" className="text-sm text-slate-300 hover:text-white font-medium">
            ← Back to Homepage
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0a1628] via-[#0f2439] to-[#1e293b]">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
