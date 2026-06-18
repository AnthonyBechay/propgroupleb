'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Mail, Phone, Clock, Send, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { normalizeApiUrl } from '@/lib/utils/api-url'

const contactFormSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().min(1, 'Name is required'),
  phone: z.string().optional(),
  message: z.string().min(1, 'Message is required'),
})
type ContactFormData = z.infer<typeof contactFormSchema>

/** Combined "Get in touch" section — form + contact details. Used on the About page. */
export function ContactSection() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const form = useForm<ContactFormData>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: { email: '', name: '', phone: '', message: '' },
  })

  const onSubmit = async (data: ContactFormData) => {
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      const baseUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL)
      const res = await fetch(`${baseUrl}/api/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (res.ok) { setIsSubmitted(true); form.reset() }
      else {
        const e = await res.json().catch(() => ({}))
        setSubmitError(e.message || 'Failed to send message. Please try again.')
      }
    } catch {
      setSubmitError('Unable to send message. Please check your connection and try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section id="contact" className="py-16 bg-slate-50 border-t border-slate-200 scroll-mt-20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-slate-900">Get in touch</h2>
            <p className="mt-2 text-slate-500">Tell us about your property needs and we&apos;ll get back within 24 hours.</p>
          </div>

          {isSubmitted ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 max-w-md mx-auto text-center">
              <CheckCircle className="w-14 h-14 text-emerald-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-slate-900 mb-1">Message sent</h3>
              <p className="text-slate-600 mb-6">We&apos;ll get back to you within 24 hours.</p>
              <Button onClick={() => setIsSubmitted(false)} className="bg-slate-900 hover:bg-slate-800">Send another</Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 sm:p-8">
                {submitError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-4">{submitError}</div>
                )}
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-slate-900 mb-1">Full Name *</label>
                      <Input id="name" {...form.register('name')} placeholder="Enter your full name" />
                      {form.formState.errors.name && <p className="text-sm text-red-600 mt-1">{form.formState.errors.name.message}</p>}
                    </div>
                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-slate-900 mb-1">Email Address *</label>
                      <Input id="email" type="email" {...form.register('email')} placeholder="Enter your email" />
                      {form.formState.errors.email && <p className="text-sm text-red-600 mt-1">{form.formState.errors.email.message}</p>}
                    </div>
                  </div>
                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-slate-900 mb-1">Phone Number</label>
                    <Input id="phone" type="tel" {...form.register('phone')} placeholder="Enter your phone number" />
                  </div>
                  <div>
                    <label htmlFor="message" className="block text-sm font-medium text-slate-900 mb-1">Message *</label>
                    <Textarea id="message" rows={5} {...form.register('message')} placeholder="Tell us about your budget, preferred locations, and whether you're looking to buy, rent, or sell…" />
                    {form.formState.errors.message && <p className="text-sm text-red-600 mt-1">{form.formState.errors.message.message}</p>}
                  </div>
                  <Button type="submit" disabled={isSubmitting} className="w-full h-12 bg-slate-900 hover:bg-slate-800 text-white font-semibold">
                    {isSubmitting ? <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" /> Sending…</> : <><Send className="h-4 w-4 mr-2" /> Send Message</>}
                  </Button>
                </form>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-6 h-fit">
                <h3 className="text-lg font-bold text-slate-900 mb-4">Contact information</h3>
                <div className="space-y-4">
                  <a href="mailto:info@propgroup.com" className="flex items-start gap-3 group">
                    <Mail className="h-5 w-5 text-slate-700 mt-0.5" />
                    <div>
                      <div className="font-medium text-slate-900">Email</div>
                      <div className="text-sm text-slate-600 group-hover:text-slate-900">info@propgroup.com</div>
                    </div>
                  </a>
                  <a href="tel:+96171934001" className="flex items-start gap-3 group">
                    <Phone className="h-5 w-5 text-slate-700 mt-0.5" />
                    <div>
                      <div className="font-medium text-slate-900">Phone</div>
                      <div className="text-sm text-slate-600 group-hover:text-slate-900">+961 71 934 001</div>
                    </div>
                  </a>
                  <div className="flex items-start gap-3">
                    <Clock className="h-5 w-5 text-slate-700 mt-0.5" />
                    <div>
                      <div className="font-medium text-slate-900">Business Hours</div>
                      <div className="text-sm text-slate-600">Mon – Fri: 9:00 AM – 6:00 PM</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
