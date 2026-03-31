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
import { Loader2, Mail, Lock, Shield } from 'lucide-react'
import Image from 'next/image'
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
    mode: 'onChange',
  })

  useEffect(() => {
    if (!loading && !hasCheckedRedirect) {
      setHasCheckedRedirect(true)

      if (user) {
        if (!user.isActive || user.bannedAt) {
          router.push('/auth/banned')
          return
        }

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
      const { normalizeApiUrl } = await import('@/lib/utils/api-url')
      const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001')

      if (typeof window !== 'undefined') {
        sessionStorage.setItem('auth_redirect', next)
      }

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

      // signIn succeeded — allow the redirect useEffect to fire again
      setHasCheckedRedirect(false)
    } catch (err) {
      console.error('Login error:', err)
      setError('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6">
        <div className="bg-white shadow-lg rounded-2xl px-8 py-10 border border-stone-200">
          <div className="text-center">
            <div className="flex justify-center">
              <Image src="/logo.png" alt="PropGroup" width={56} height={56} />
            </div>

            <h1 className="mt-4 text-3xl font-bold text-stone-900">
              Welcome Back
            </h1>

            <p className="mt-2 text-sm text-stone-500">
              Sign in to access your account
            </p>

            {next.startsWith('/admin') && (
              <div className="mt-4 inline-flex items-center px-4 py-2 rounded-lg text-xs font-semibold bg-[#1B4965] text-white">
                <Shield className="h-4 w-4 mr-2" />
                Admin Login Required
              </div>
            )}
          </div>

          {error && (
            <div className="mt-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2 text-sm">
              <div className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0"></div>
              <span className="font-medium">{error}</span>
            </div>
          )}

          {/* Google Sign In */}
          <div className="mt-6">
            <Button
              type="button"
              variant="outline"
              className="w-full border-stone-200 hover:border-stone-300 hover:bg-stone-50 rounded-xl font-semibold py-6"
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
                  <span className="h-5 w-5 mr-3 font-bold text-[#1B4965] text-lg flex items-center justify-center">G</span>
                  Continue with Google
                </>
              )}
            </Button>
          </div>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-stone-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-stone-400 font-medium">Or continue with email</span>
              </div>
            </div>
          </div>

          <form onSubmit={form.handleSubmit(handleLogin)} className="mt-6 space-y-5">
            <div>
              <Label htmlFor="email" className="font-semibold text-stone-800">Email Address</Label>
              <div className="mt-2 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-stone-400" />
                </div>
                <Input
                  id="email"
                  type="email"
                  {...form.register('email')}
                  placeholder="admin@example.com"
                  className="pl-10 border-stone-200 rounded-xl focus:border-[#1B4965] focus:ring-[#1B4965]"
                  autoComplete="email"
                  disabled={isLoading || isGoogleLoading}
                  readOnly={false}
                />
              </div>
              {form.formState.errors.email && (
                <p className="mt-1 text-xs text-red-600 font-medium">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="password" className="font-semibold text-stone-800">Password</Label>
              <div className="mt-2 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-stone-400" />
                </div>
                <Input
                  id="password"
                  type="password"
                  {...form.register('password')}
                  placeholder="Enter your password"
                  className="pl-10 border-stone-200 rounded-xl focus:border-[#1B4965] focus:ring-[#1B4965]"
                  autoComplete="current-password"
                  disabled={isLoading || isGoogleLoading}
                  readOnly={false}
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
                  className="h-4 w-4 text-[#1B4965] focus:ring-[#1B4965] border-stone-300 rounded"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-stone-600">
                  Remember me
                </label>
              </div>

              <div className="text-sm">
                <span
                  className="font-medium text-stone-400 cursor-default"
                  title="Password reset coming soon"
                >
                  Forgot password?
                </span>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#1B4965] hover:bg-[#2B6985] text-white rounded-xl font-semibold py-6"
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
          </form>

          <div className="mt-6 text-center">
            <Link
              href="/auth/signup"
              className="text-sm text-stone-600 hover:text-stone-900 font-medium"
            >
              Don&apos;t have an account?{' '}
              <span className="text-[#C97B4B] hover:text-[#B86A3A] font-semibold">Sign up</span>
            </Link>
          </div>
        </div>

        <div className="text-center">
          <Link href="/" className="text-sm text-stone-500 hover:text-stone-700 font-medium">
            &larr; Back to Homepage
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-stone-100">
        <Loader2 className="h-8 w-8 animate-spin text-[#1B4965]" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
