'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/use-toast'
import { submitInquiry } from '@/actions/inquiry-actions'
import { useState } from 'react'

const inquirySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  message: z.string().optional(),
})

type InquiryFormData = z.infer<typeof inquirySchema>

interface InquiryFormProps {
  propertyId: string
  defaultName?: string
  defaultEmail?: string
  messagePlaceholder?: string
  onSuccess?: () => void
  onCancel?: () => void
  showCancel?: boolean
  submitLabel?: string
}

export function InquiryForm({
  propertyId,
  defaultName = '',
  defaultEmail = '',
  messagePlaceholder = "Tell us about your property needs or any specific questions...",
  onSuccess,
  onCancel,
  showCancel = false,
  submitLabel = 'Send Inquiry',
}: InquiryFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InquiryFormData>({
    resolver: zodResolver(inquirySchema),
    defaultValues: {
      name: defaultName,
      email: defaultEmail,
      phone: '',
      message: '',
    },
  })

  const onSubmit = async (data: InquiryFormData) => {
    setIsSubmitting(true)
    try {
      const result = await submitInquiry({
        propertyId,
        name: data.name,
        email: data.email,
        phone: data.phone || undefined,
        message: data.message || undefined,
      })

      if (result.success) {
        toast({
          title: 'Inquiry sent!',
          description: result.message || 'We will get back to you soon.',
        })
        reset()
        onSuccess?.()
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to send inquiry',
          variant: 'destructive',
        })
      }
    } catch {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="inquiry-name">Full Name <span className="text-red-500">*</span></Label>
        <Input
          id="inquiry-name"
          {...register('name')}
          placeholder="John Doe"
          className="h-11"
        />
        {errors.name && (
          <p className="text-sm text-red-600">{errors.name.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="inquiry-email">Email Address <span className="text-red-500">*</span></Label>
        <Input
          id="inquiry-email"
          type="email"
          {...register('email')}
          placeholder="john@example.com"
          className="h-11"
        />
        {errors.email && (
          <p className="text-sm text-red-600">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="inquiry-phone">Phone Number</Label>
        <Input
          id="inquiry-phone"
          type="tel"
          {...register('phone')}
          placeholder="+961 71 000 000"
          className="h-11"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="inquiry-message">Message</Label>
        <Textarea
          id="inquiry-message"
          {...register('message')}
          placeholder={messagePlaceholder}
          rows={4}
          className="resize-none"
        />
      </div>

      <div className={`flex gap-3 ${showCancel ? 'pt-4' : 'pt-2'}`}>
        {showCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="flex-1"
          >
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          disabled={isSubmitting}
          className={`${showCancel ? 'flex-1' : 'w-full'} bg-slate-900 hover:bg-slate-800 text-white`}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Sending...
            </>
          ) : (
            submitLabel
          )}
        </Button>
      </div>
    </form>
  )
}
