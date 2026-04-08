'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ArrowLeft, Mail, CheckCircle, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { normalizeApiUrl } from '@/lib/utils/api-url'

const schema = z.object({
  email: z.string().email('Please enter a valid email address'),
})

type FormData = z.infer<typeof schema>

export default function ForgotPasswordPage() {
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    setError(null)
    try {
      const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL)
      const response = await fetch(`${apiUrl}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.email }),
      })

      if (response.ok) {
        setIsSubmitted(true)
      } else {
        const errData = await response.json().catch(() => ({}))
        setError(errData.error || 'Something went wrong. Please try again.')
      }
    } catch {
      setError('Unable to connect. Please check your connection.')
    }
  }

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Check your email</h1>
          <p className="text-slate-600 mb-6">
            If an account exists with that email, we&apos;ve sent a password reset link. It expires in 1 hour.
          </p>
          <Link href="/auth/login">
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Login
            </Button>
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
            <Mail className="w-6 h-6 text-[#1B3A5C]" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 text-center mb-2">Forgot your password?</h1>
          <p className="text-sm text-slate-600 text-center mb-6">
            Enter your email and we&apos;ll send you a reset link.
          </p>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
              <Input
                id="email"
                type="email"
                {...register('email')}
                placeholder="you@example.com"
                className="h-11"
              />
              {errors.email && <p className="text-sm text-red-600 mt-1">{errors.email.message}</p>}
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-11 bg-[#1B3A5C] hover:bg-[#24507D] text-white"
            >
              {isSubmitting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending...</>
              ) : (
                'Send Reset Link'
              )}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <Link href="/auth/login" className="text-sm text-[#1B3A5C] hover:underline">
              <ArrowLeft className="w-3 h-3 inline mr-1" />
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
