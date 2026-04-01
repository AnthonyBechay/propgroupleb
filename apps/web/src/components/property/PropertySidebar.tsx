'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/use-toast'
import { submitInquiry } from '@/actions/inquiry-actions'
import { Heart, TrendingUp, Calendar, Loader2 } from 'lucide-react'
import { normalizeApiUrl } from '@/lib/utils/api-url'

interface PropertySidebarProps {
  propertyId: string
  title: string
  price: number
  currency: string
  area: number
  expectedROI?: number | null
}

export function PropertySidebar({
  propertyId,
  title,
  price,
  currency,
  area,
  expectedROI,
}: PropertySidebarProps) {
  const { user } = useAuth()
  const router = useRouter()

  const [showInquiryDialog, setShowInquiryDialog] = useState(false)
  const [showViewingDialog, setShowViewingDialog] = useState(false)

  // Favorites state
  const [isFavorited, setIsFavorited] = useState(false)
  const [isLoadingFavorite, setIsLoadingFavorite] = useState(false)

  // Inquiry form state
  const [inquiryName, setInquiryName] = useState('')
  const [inquiryEmail, setInquiryEmail] = useState('')
  const [inquiryPhone, setInquiryPhone] = useState('')
  const [inquiryMessage, setInquiryMessage] = useState('')
  const [isSubmittingInquiry, setIsSubmittingInquiry] = useState(false)

  // Viewing form state
  const [viewingDate, setViewingDate] = useState('')
  const [viewingMessage, setViewingMessage] = useState('')
  const [isSubmittingViewing, setIsSubmittingViewing] = useState(false)

  const apiBaseUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL)

  // Check initial favorite status
  useEffect(() => {
    if (!user) return

    async function checkFavorite() {
      try {
        const res = await fetch(`${apiBaseUrl}/api/favorites/check/${propertyId}`, {
          credentials: 'include',
        })
        if (res.ok) {
          const data = await res.json()
          setIsFavorited(data.data?.isFavorited || false)
        }
      } catch {
        // Silently fail - not critical
      }
    }

    checkFavorite()
  }, [user, propertyId, apiBaseUrl])

  // Pre-fill email when user is available
  useEffect(() => {
    if (user?.email) {
      setInquiryEmail(user.email)
    }
    if (user?.firstName) {
      setInquiryName(`${user.firstName}${user.lastName ? ' ' + user.lastName : ''}`)
    }
  }, [user])

  const handleFavoriteToggle = async () => {
    if (!user) {
      router.push('/auth/login?next=/property/' + propertyId)
      return
    }

    setIsLoadingFavorite(true)
    try {
      const method = isFavorited ? 'DELETE' : 'POST'
      const res = await fetch(`${apiBaseUrl}/api/favorites/${propertyId}`, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      })

      if (res.ok) {
        setIsFavorited(!isFavorited)
        toast({
          title: isFavorited ? 'Removed from favorites' : 'Added to favorites',
          description: isFavorited
            ? 'Property removed from your favorites'
            : 'You can view your favorites in your portal',
        })
      } else {
        toast({
          title: 'Error',
          description: 'Failed to update favorite status',
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
      setIsLoadingFavorite(false)
    }
  }

  const handleInquirySubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!inquiryName.trim() || !inquiryEmail.trim()) {
      toast({
        title: 'Error',
        description: 'Name and email are required',
        variant: 'destructive',
      })
      return
    }

    setIsSubmittingInquiry(true)
    try {
      const result = await submitInquiry({
        propertyId,
        name: inquiryName,
        email: inquiryEmail,
        phone: inquiryPhone || undefined,
        message: inquiryMessage || undefined,
      })

      if (result.success) {
        toast({
          title: 'Inquiry sent!',
          description: result.message || 'We will get back to you soon.',
        })
        setInquiryMessage('')
        setInquiryPhone('')
        setShowInquiryDialog(false)
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
      setIsSubmittingInquiry(false)
    }
  }

  const handleViewingSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!viewingDate) {
      toast({
        title: 'Error',
        description: 'Please select a preferred date',
        variant: 'destructive',
      })
      return
    }

    setIsSubmittingViewing(true)
    try {
      const name = user
        ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email
        : 'Guest'
      const email = user?.email || ''

      const result = await submitInquiry({
        propertyId,
        name,
        email,
        message: `[Viewing Request] Preferred date: ${viewingDate}${viewingMessage ? '. ' + viewingMessage : ''}`,
      })

      if (result.success) {
        toast({
          title: 'Viewing request sent!',
          description: 'We will confirm your viewing appointment soon.',
        })
        setViewingDate('')
        setViewingMessage('')
        setShowViewingDialog(false)
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to send viewing request',
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
      setIsSubmittingViewing(false)
    }
  }

  return (
    <>
      <div className="space-y-6">
        {/* Price Card */}
        <div className="bg-white rounded-xl border border-stone-200 p-6 sticky top-24">
          <div className="text-center mb-6">
            <div className="text-3xl font-bold text-stone-900 mb-1">
              {currency} {price?.toLocaleString()}
            </div>
            {area > 0 && (
              <div className="text-sm text-stone-500">
                {currency} {Math.round(price / area).toLocaleString()} / m²
              </div>
            )}
            {expectedROI != null && expectedROI > 0 && (
              <div className="mt-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-sm font-medium">
                <TrendingUp className="w-3.5 h-3.5" />
                {expectedROI}% ROI
              </div>
            )}
          </div>

          <div className="space-y-3">
            <Button
              className="w-full bg-[#1B4965] hover:bg-[#2B6985] text-white"
              onClick={() => setShowInquiryDialog(true)}
            >
              Request Information
            </Button>
            <Button
              variant="outline"
              className="w-full border-[#1B4965] text-[#1B4965] hover:bg-[#E8F1F5]"
              onClick={() => {
                if (!user) {
                  router.push('/auth/login?next=/property/' + propertyId)
                  return
                }
                setShowViewingDialog(true)
              }}
            >
              <Calendar className="w-4 h-4 mr-2" />
              Schedule Viewing
            </Button>
            <Button
              variant="outline"
              className={`w-full ${
                isFavorited
                  ? 'border-red-300 text-red-600 bg-red-50 hover:bg-red-100'
                  : 'border-stone-300 text-stone-700 hover:bg-stone-50'
              }`}
              onClick={handleFavoriteToggle}
              disabled={isLoadingFavorite}
            >
              {isLoadingFavorite ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Heart
                  className={`w-4 h-4 mr-2 ${isFavorited ? 'fill-red-500 text-red-500' : ''}`}
                />
              )}
              {isFavorited ? 'Saved to Favorites' : 'Add to Favorites'}
            </Button>
          </div>
        </div>
      </div>

      {/* Inquiry Dialog */}
      <Dialog open={showInquiryDialog} onOpenChange={setShowInquiryDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-stone-900">Request Information</DialogTitle>
            <DialogDescription className="text-stone-500">
              Ask about {title}. We will respond within 24 hours.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleInquirySubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="inquiry-name" className="text-stone-700">
                Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="inquiry-name"
                value={inquiryName}
                onChange={(e) => setInquiryName(e.target.value)}
                placeholder="Your full name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inquiry-email" className="text-stone-700">
                Email <span className="text-red-500">*</span>
              </Label>
              <Input
                id="inquiry-email"
                type="email"
                value={inquiryEmail}
                onChange={(e) => setInquiryEmail(e.target.value)}
                placeholder="your@email.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inquiry-phone" className="text-stone-700">
                Phone
              </Label>
              <Input
                id="inquiry-phone"
                type="tel"
                value={inquiryPhone}
                onChange={(e) => setInquiryPhone(e.target.value)}
                placeholder="+1 (555) 000-0000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inquiry-message" className="text-stone-700">
                Message
              </Label>
              <Textarea
                id="inquiry-message"
                value={inquiryMessage}
                onChange={(e) => setInquiryMessage(e.target.value)}
                placeholder="I'm interested in this property..."
                rows={3}
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-[#1B4965] hover:bg-[#2B6985] text-white"
              disabled={isSubmittingInquiry}
            >
              {isSubmittingInquiry ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                'Send Inquiry'
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Viewing Dialog */}
      <Dialog open={showViewingDialog} onOpenChange={setShowViewingDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-stone-900">Schedule a Viewing</DialogTitle>
            <DialogDescription className="text-stone-500">
              Request a viewing for {title}. We will confirm your appointment.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleViewingSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="viewing-date" className="text-stone-700">
                Preferred Date <span className="text-red-500">*</span>
              </Label>
              <Input
                id="viewing-date"
                type="date"
                value={viewingDate}
                onChange={(e) => setViewingDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="viewing-message" className="text-stone-700">
                Additional Notes
              </Label>
              <Textarea
                id="viewing-message"
                value={viewingMessage}
                onChange={(e) => setViewingMessage(e.target.value)}
                placeholder="Any specific time preferences or questions..."
                rows={3}
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-[#1B4965] hover:bg-[#2B6985] text-white"
              disabled={isSubmittingViewing}
            >
              {isSubmittingViewing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                'Request Viewing'
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
