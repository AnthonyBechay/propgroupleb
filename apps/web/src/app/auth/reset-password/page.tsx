'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Lock, CheckCircle, Loader2, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { normalizeApiUrl } from '@/lib/utils/api-url'

const schema = z.object({
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Must contain at least one number'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

type FormData = z.infer<typeof schema>

function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  if (!token) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Invalid Reset Link</h1>
          <p className="text-slate-600 mb-6">This password reset link is invalid or has expired.</p>
          <Link href="/auth/forgot-password">
            <Button className="bg-[#1B3A5C] hover:bg-[#24507D] text-white">Request New Link</Button>
          </Link>
        </div>
      </div>
    )
  }

  const onSubmit = async (data: FormData) => {
    setError(null)
    try {
      const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL)
      const response = await fetch(`${apiUrl}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password: data.password }),
      })

      if (response.ok) {
        setIsSuccess(true)
      } else {
        const errData = await response.json().catch(() => ({}))
        setError(errData.error || 'Reset failed. The link may have expired.')
      }
    } catch {
      setError('Unable to connect. Please check your connection.')
    }
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Password Reset!</h1>
          <p className="text-slate-600 mb-6">Your password has been updated. You can now log in.</p>
          <Link href="/auth/login">
            <Button className="bg-[#1B3A5C] hover:bg-[#24507D] text-white">Go to Login</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <div className="w-12 h-12 bg-[#E0EDF7] rounded-xl flex items-center justify-center mx-auto mb-4">
            <Lock className="w-6 h-6 text-[#1B3A5C]" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 text-center mb-2">Set New Password</h1>
          <p className="text-sm text-slate-600 text-center mb-6">Enter your new password below.</p>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm mb-4">{error}</div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
              <Input id="password" type="password" {...register('password')} placeholder="Min 8 chars, 1 uppercase, 1 number" className="h-11" />
              {errors.password && <p className="text-sm text-red-600 mt-1">{errors.password.message}</p>}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 mb-1">Confirm Password</label>
              <Input id="confirmPassword" type="password" {...register('confirmPassword')} placeholder="Re-enter your password" className="h-11" />
              {errors.confirmPassword && <p className="text-sm text-red-600 mt-1">{errors.confirmPassword.message}</p>}
            </div>

            <Button type="submit" disabled={isSubmitting} className="w-full h-11 bg-[#1B3A5C] hover:bg-[#24507D] text-white">
              {isSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Resetting...</> : 'Reset Password'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#1B3A5C]" />
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  )
}
