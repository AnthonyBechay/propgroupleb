'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const contactFormSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().min(1, 'Name is required'),
  phone: z.string().optional(),
  message: z.string().min(1, 'Message is required'),
})
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Mail,
  Phone,
  MapPin,
  Clock,
  Send,
  CheckCircle
} from 'lucide-react'

type ContactFormData = {
  email: string
  name: string
  phone?: string
  message: string
}

export default function ContactPage() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const form = useForm<ContactFormData>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      email: '',
      name: '',
      phone: '',
      message: '',
    },
  })

  const onSubmit = async (data: ContactFormData) => {
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      const { normalizeApiUrl } = await import('@/lib/utils/api-url')
      const baseUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL)
      const response = await fetch(`${baseUrl}/api/contact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (response.ok) {
        setIsSubmitted(true)
        form.reset()
      } else {
        const errorData = await response.json().catch(() => ({}))
        setSubmitError(errorData.message || 'Failed to send message. Please try again.')
      }
    } catch (error) {
      console.error('Error sending message:', error)
      setSubmitError('Unable to send message. Please check your connection and try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-[#1B3A5C] flex items-center justify-center">
        <div className="bg-white border border-slate-200 rounded-2xl p-8 max-w-md text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            Message Sent Successfully!
          </h2>
          <p className="text-slate-600 mb-6">
            We'll get back to you within 24 hours to discuss your investment goals.
          </p>
          <Button
            onClick={() => setIsSubmitted(false)}
            className="bg-[#1B3A5C] hover:bg-[#152D4A]"
          >
            Send Another Message
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative py-20 sm:py-24 bg-[#1B3A5C]">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white mb-6">
              Start Your{' '}
              <span className="text-[#C49A2E]">
                Investment Journey
              </span>
            </h1>
            <p className="text-xl text-slate-300">
              Have questions about ROI projections or available properties? Get in touch with our investment team.
            </p>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Contact Form */}
            <div className="lg:col-span-2">
              <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8">
                <h2 className="text-2xl font-bold text-slate-900 mb-2">
                  Get Investment Details
                </h2>
                <p className="text-slate-600 mb-6">
                  Tell us about your investment goals and we'll provide tailored property recommendations.
                </p>
                {submitError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-4">
                    {submitError}
                  </div>
                )}
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-slate-900 mb-1">
                        Full Name *
                      </label>
                      <Input
                        id="name"
                        {...form.register('name')}
                        placeholder="Enter your full name"
                      />
                      {form.formState.errors.name && (
                        <p className="text-sm text-red-600 mt-1">
                          {form.formState.errors.name.message}
                        </p>
                      )}
                    </div>
                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-slate-900 mb-1">
                        Email Address *
                      </label>
                      <Input
                        id="email"
                        type="email"
                        {...form.register('email')}
                        placeholder="Enter your email"
                      />
                      {form.formState.errors.email && (
                        <p className="text-sm text-red-600 mt-1">
                          {form.formState.errors.email.message}
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-slate-900 mb-1">
                      Phone Number
                    </label>
                    <Input
                      id="phone"
                      type="tel"
                      {...form.register('phone')}
                      placeholder="Enter your phone number"
                    />
                    {form.formState.errors.phone && (
                      <p className="text-sm text-red-600 mt-1">
                        {form.formState.errors.phone.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="message" className="block text-sm font-medium text-slate-900 mb-1">
                      Investment Goals *
                    </label>
                    <Textarea
                      id="message"
                      rows={6}
                      {...form.register('message')}
                      placeholder="Tell us about your budget, target ROI, preferred locations, and investment timeline..."
                    />
                    {form.formState.errors.message && (
                      <p className="text-sm text-red-600 mt-1">
                        {form.formState.errors.message.message}
                      </p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full h-12 bg-[#1B3A5C] hover:bg-[#152D4A] text-white font-semibold"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Get Investment Info
                      </>
                    )}
                  </Button>
                </form>
              </div>
            </div>

            {/* Contact Information */}
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-2xl p-6">
                <h3 className="text-lg font-bold text-slate-900 mb-4">
                  Contact Information
                </h3>
                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <Mail className="h-5 w-5 text-[#1B3A5C] mt-1" />
                    <div>
                      <div className="font-medium text-slate-900">Email</div>
                      <div className="text-sm text-slate-600">invest@propgroup.com</div>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <Phone className="h-5 w-5 text-[#1B3A5C] mt-1" />
                    <div>
                      <div className="font-medium text-slate-900">Phone</div>
                      <div className="text-sm text-slate-600">+1 (555) 123-4567</div>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <Clock className="h-5 w-5 text-[#1B3A5C] mt-1" />
                    <div>
                      <div className="font-medium text-slate-900">Business Hours</div>
                      <div className="text-sm text-slate-600">
                        Mon - Fri: 9:00 AM - 6:00 PM
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
