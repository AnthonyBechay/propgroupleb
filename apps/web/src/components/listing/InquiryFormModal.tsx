'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { MessageSquare, Send, CheckCircle2, AlertCircle } from 'lucide-react'
import { normalizeApiUrl } from '@/lib/utils/api-url'
import { track } from '@/lib/analytics'

interface InquiryFormModalProps {
  listingId: string
  listingTitle: string
  buildingId?: string
}

export function InquiryFormModal({ listingId, listingTitle, buildingId }: InquiryFormModalProps) {
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    message: '',
  })

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.email.trim()) return

    setIsSubmitting(true)
    setError(null)

    try {
      const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
      const res = await fetch(`${apiUrl}/api/inquiries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          buildingId: buildingId ?? null,
          listingId,
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || undefined,
          message: form.message.trim() || undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error ?? `Request failed (${res.status})`)
      }

      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (next) {
      // Opening the contact form is the key conversion-intent signal.
      track('inquiry_click', { listingId, buildingId })
    }
    if (!next) {
      // Reset state when closing
      setTimeout(() => {
        setSuccess(false)
        setError(null)
        setForm({ name: '', email: '', phone: '', message: '' })
      }, 300)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="w-full" size="lg">
          <MessageSquare className="w-4 h-4 mr-2" />
          Contact Agent
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enquire about this property</DialogTitle>
          <DialogDescription className="line-clamp-2">{listingTitle}</DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-500" />
            <div>
              <p className="font-semibold text-slate-900">Inquiry sent!</p>
              <p className="text-sm text-slate-500 mt-1">
                We&apos;ll get back to you as soon as possible.
              </p>
            </div>
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Close
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label htmlFor="inquiry-name">Full name *</Label>
              <Input
                id="inquiry-name"
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="Your name"
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="inquiry-email">Email *</Label>
              <Input
                id="inquiry-email"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="you@example.com"
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="inquiry-phone">Phone number</Label>
              <Input
                id="inquiry-phone"
                name="phone"
                type="tel"
                value={form.phone}
                onChange={handleChange}
                placeholder="+961 ..."
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="inquiry-message">Message</Label>
              <Textarea
                id="inquiry-message"
                name="message"
                value={form.message}
                onChange={handleChange}
                placeholder="I am interested in this property and would like more information..."
                rows={3}
                disabled={isSubmitting}
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <>Sending...</>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send Inquiry
                </>
              )}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
