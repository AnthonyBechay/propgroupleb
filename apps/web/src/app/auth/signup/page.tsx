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
import { Building2, Loader2, Mail, Lock, User as UserIcon } from 'lucide-react'
import Link from 'next/link'

const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
})

type SignupData = z.infer<typeof signupSchema>

function SignupForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') || '/portal/dashboard'
  const { signUp, user, loading } = useAuth()

  const [isLoading, setIsLoading] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const form = useForm<SignupData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
      firstName: '',
      lastName: '',
    },
  })

  // Check if already logged in
  useEffect(() => {
    if (user && !loading) {
      router.push(next)
    }
  }, [user, loading, router, next])

  const handleGoogleSignup = async () => {
    setIsGoogleLoading(true)
    setError(null)

    try {
      // Get the API base URL - normalize it (same pattern as AuthModal)
      const { normalizeApiUrl } = await import('@/lib/utils/api-url')
      const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001')

      // Store the intended next page
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('auth_redirect', next)
      }

      // Redirect to Google OAuth - endpoint is /api/auth/google
      window.location.href = `${apiUrl}/api/auth/google`
    } catch (err) {
      console.error('Google signup error:', err)
      setError('Failed to initiate Google signup')
      setIsGoogleLoading(false)
    }
  }

  const handleSignup = async (data: SignupData) => {
    setIsLoading(true)
    setError(null)

    try {
      const { error } = await signUp(data.email, data.password, {
        firstName: data.firstName,
        lastName: data.lastName,
      })

      if (error) {
        setError(error)
        return
      }

      // Redirect will be handled by the useEffect above
    } catch (err) {
      console.error('Signup error:', err)
      setError('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0a1628] via-[#0f2439] to-[#1e293b]">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
      </div>
    )
  }

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
              Create Account
            </h1>

            <p className="mt-2 text-sm text-slate-600">
              Start your investment journey today
            </p>
          </div>

          {error && (
            <div className="mt-6 bg-red-50 border-2 border-red-200 text-red-800 px-4 py-3 rounded-xl flex items-center gap-2">
              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              <span className="font-medium">{error}</span>
            </div>
          )}

          {/* Google Sign Up Button */}
          <div className="mt-6">
            <Button
              type="button"
              variant="outline"
              className="w-full border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 rounded-xl font-bold py-6"
              onClick={handleGoogleSignup}
              disabled={isGoogleLoading}
            >
              {isGoogleLoading ? (
                <>
                  <Loader2 className="h-5 w-5 mr-3 animate-spin" />
                  Connecting to Google...
                </>
              ) : (
                <>
                  <span className="h-5 w-5 mr-3 font-bold text-blue-600 text-lg flex items-center justify-center">G</span>
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

          <form onSubmit={form.handleSubmit(handleSignup)} className="mt-6 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName" className="font-bold text-gray-900">First Name</Label>
                <div className="mt-2 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <UserIcon className="h-4 w-4 text-slate-400" />
                  </div>
                  <Input
                    id="firstName"
                    type="text"
                    {...form.register('firstName')}
                    placeholder="John"
                    className="pl-10 border-2 border-slate-200 rounded-xl focus:border-cyan-500 focus:ring-cyan-500"
                    autoComplete="given-name"
                  />
                </div>
                {form.formState.errors.firstName && (
                  <p className="mt-1 text-xs text-red-600 font-medium">
                    {form.formState.errors.firstName.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="lastName" className="font-bold text-gray-900">Last Name</Label>
                <div className="mt-2 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <UserIcon className="h-4 w-4 text-slate-400" />
                  </div>
                  <Input
                    id="lastName"
                    type="text"
                    {...form.register('lastName')}
                    placeholder="Doe"
                    className="pl-10 border-2 border-slate-200 rounded-xl focus:border-cyan-500 focus:ring-cyan-500"
                    autoComplete="family-name"
                  />
                </div>
                {form.formState.errors.lastName && (
                  <p className="mt-1 text-xs text-red-600 font-medium">
                    {form.formState.errors.lastName.message}
                  </p>
                )}
              </div>
            </div>

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
                  placeholder="john@example.com"
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
                  placeholder="Minimum 8 characters"
                  className="pl-10 border-2 border-slate-200 rounded-xl focus:border-cyan-500 focus:ring-cyan-500"
                  autoComplete="new-password"
                />
              </div>
              {form.formState.errors.password && (
                <p className="mt-1 text-xs text-red-600 font-medium">
                  {form.formState.errors.password.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="confirmPassword" className="font-bold text-gray-900">Confirm Password</Label>
              <div className="mt-2 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-slate-400" />
                </div>
                <Input
                  id="confirmPassword"
                  type="password"
                  {...form.register('confirmPassword')}
                  placeholder="Re-enter password"
                  className="pl-10 border-2 border-slate-200 rounded-xl focus:border-cyan-500 focus:ring-cyan-500"
                  autoComplete="new-password"
                />
              </div>
              {form.formState.errors.confirmPassword && (
                <p className="mt-1 text-xs text-red-600 font-medium">
                  {form.formState.errors.confirmPassword.message}
                </p>
              )}
            </div>

            <div className="space-y-3 pt-2">
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white rounded-xl font-bold py-6 shadow-lg"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Creating Account...
                  </>
                ) : (
                  'Create Account'
                )}
              </Button>

              <p className="text-xs text-center text-slate-500">
                By signing up, you agree to our{' '}
                <Link href="/terms" className="text-cyan-600 hover:text-cyan-700 font-medium">
                  Terms of Service
                </Link>
                {' '}and{' '}
                <Link href="/privacy" className="text-cyan-600 hover:text-cyan-700 font-medium">
                  Privacy Policy
                </Link>
              </p>
            </div>
          </form>

          <div className="mt-6 text-center">
            <Link
              href="/auth/login"
              className="text-sm text-slate-600 hover:text-gray-900 font-medium"
            >
              Already have an account?{' '}
              <span className="text-cyan-600 hover:text-cyan-700 font-bold">Sign in</span>
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

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0a1628] via-[#0f2439] to-[#1e293b]">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
      </div>
    }>
      <SignupForm />
    </Suspense>
  )
}
