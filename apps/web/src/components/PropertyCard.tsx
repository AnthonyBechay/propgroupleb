'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  Heart,
  MapPin,
  Bed,
  Bath,
  Square,
  TrendingUp,
  Home,
  BadgeCheck,
  Clock,
  Eye,
  ArrowRight,
  Sparkles,
  DollarSign,
  BarChart3,
  Shield,
  Award,
  Camera
} from 'lucide-react'
import { submitInquiry } from '@/actions/inquiry-actions'
import { useAuth } from '@/contexts/AuthContext'
import { normalizeApiUrl, normalizeFileUrl } from '@/lib/utils/api-url'
import { AuthModal } from '@/components/auth/AuthModal'
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
import { useForm } from 'react-hook-form'
import { toast } from '@/components/ui/use-toast'

interface PropertyCardProps {
  id: string
  title: string
  description: string
  price: number
  currency: string
  bedrooms: number
  bathrooms: number
  area: number
  country: string
  status: string
  images: string[]
  isGoldenVisaEligible?: boolean
  investmentData?: {
    expectedROI?: number | null
    rentalYield?: number | null
    capitalGrowth?: number | null
  }
  isFavorited?: boolean
  className?: string
  featured?: boolean
}

export function PropertyCard({
  id,
  title,
  description,
  price,
  currency,
  bedrooms,
  bathrooms,
  area,
  country,
  status,
  images,
  isGoldenVisaEligible,
  investmentData,
  isFavorited: initialFavorited = false,
  className,
  featured = false,
}: PropertyCardProps) {
  const { user } = useAuth()
  const [isFavorited, setIsFavorited] = useState(initialFavorited)
  const [isLoadingFavorite, setIsLoadingFavorite] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [showInquiryModal, setShowInquiryModal] = useState(false)
  const [isSubmittingInquiry, setIsSubmittingInquiry] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: {
      name: '',
      email: user?.email || '',
      phone: '',
      message: '',
    },
  })

  const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL)

  const handleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (!user) {
      setShowAuthModal(true)
      return
    }

    setIsLoadingFavorite(true)
    try {
      // Check current favorite status from the backend
      const checkRes = await fetch(`${apiUrl}/api/favorites/check/${id}`, {
        credentials: 'include',
      })
      const checkData = await checkRes.json()
      const currentlyFavorited = checkData?.data?.isFavorited ?? isFavorited

      // Toggle: if currently favorited, DELETE; otherwise, POST
      const method = currentlyFavorited ? 'DELETE' : 'POST'
      const toggleRes = await fetch(`${apiUrl}/api/favorites/${id}`, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      })

      if (toggleRes.ok) {
        const newFavorited = !currentlyFavorited
        setIsFavorited(newFavorited)
        toast({
          title: newFavorited ? 'Added to favorites' : 'Removed from favorites',
          description: newFavorited
            ? 'You can view your favorites in your portal'
            : 'Property removed from your favorites',
        })
      } else {
        const errData = await toggleRes.json().catch(() => ({}))
        toast({
          title: 'Error',
          description: errData.message || errData.error || 'Failed to update favorite status',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      })
    } finally {
      setIsLoadingFavorite(false)
    }
  }

  const onInquirySubmit = async (data: any) => {
    setIsSubmittingInquiry(true)
    try {
      const result = await submitInquiry({
        propertyId: id,
        ...data,
      })

      if (result.success) {
        toast({
          title: 'Inquiry sent!',
          description: result.message,
        })
        reset()
        setShowInquiryModal(false)
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to send inquiry',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      })
    } finally {
      setIsSubmittingInquiry(false)
    }
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price)
  }

  const statusConfig = {
    OFF_PLAN: {
      bg: 'bg-[#1B4965]',
      text: 'text-white',
      label: 'Off Plan',
      icon: Sparkles
    },
    NEW_BUILD: {
      bg: 'bg-emerald-600',
      text: 'text-white',
      label: 'New Build',
      icon: Award
    },
    RESALE: {
      bg: 'bg-stone-600',
      text: 'text-white',
      label: 'Resale',
      icon: Shield
    },
  }[status] || { bg: 'bg-stone-500', text: 'text-white', label: status, icon: Home }

  const defaultImage = '/placeholder-property.jpg'
  const mainImage = images && images.length > 0 ? normalizeFileUrl(images[currentImageIndex]) : defaultImage

  // Calculate best metric to highlight
  const bestMetric = investmentData ?
    Math.max(
      investmentData.expectedROI || 0,
      investmentData.rentalYield || 0,
      investmentData.capitalGrowth || 0
    ) : 0

  // Determine label for the best metric
  const bestMetricLabel = (() => {
    if (!investmentData || bestMetric === 0) return null
    if (bestMetric === investmentData.expectedROI) return 'ROI'
    if (bestMetric === investmentData.rentalYield) return 'Yield'
    return 'Growth'
  })()

  const StatusIcon = statusConfig.icon

  return (
    <>
      <div className={`group relative bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm hover:shadow-lg transition-all duration-500 transform hover:-translate-y-2 ${className} ${featured ? 'ring-2 ring-[#C97B4B] ring-offset-2' : ''}`}>
        {/* Featured ribbon */}
        {featured && (
          <div className="absolute top-4 -right-8 bg-[#C97B4B] text-white text-xs font-bold py-1 px-12 rotate-45 z-20 shadow-lg">
            FEATURED
          </div>
        )}

        {/* Image Container */}
        <div className="relative aspect-[4/3] overflow-hidden bg-stone-100">
          <Link href={`/property/${id}`}>
            <div className="relative w-full h-full">
              {(mainImage === defaultImage || imageError) ? (
                <div className="w-full h-full flex items-center justify-center">
                  <Home className="w-16 h-16 text-stone-400" />
                </div>
              ) : (
                <>
                  <Image
                    src={mainImage}
                    alt={title}
                    fill
                    className="object-cover group-hover:scale-110 transition-transform duration-700"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    onError={() => setImageError(true)}
                  />
                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                </>
              )}
            </div>
          </Link>

          {/* Image counter */}
          {images && images.length > 1 && (
            <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full text-white text-xs font-medium flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5" />
              {images.length} photos
            </div>
          )}

          {/* Top badges */}
          <div className="absolute top-4 left-4 flex flex-wrap gap-2">
            <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${statusConfig.bg} ${statusConfig.text} shadow-lg backdrop-blur-sm flex items-center gap-1`}>
              <StatusIcon className="w-3 h-3" />
              {statusConfig.label}
            </span>

            {isGoldenVisaEligible && (
              <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-[#C97B4B] text-white shadow-lg backdrop-blur-sm flex items-center gap-1">
                <BadgeCheck className="w-3 h-3" />
                Golden Visa
              </span>
            )}

            {bestMetric > 15 && (
              <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-600 text-white shadow-lg backdrop-blur-sm flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                High ROI
              </span>
            )}
          </div>

          {/* Favorite Button */}
          <button
            onClick={handleFavorite}
            disabled={isLoadingFavorite}
            className="absolute top-4 right-4 bg-white/90 hover:bg-white backdrop-blur-sm p-2.5 rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-110 group/fav"
            aria-label={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Heart
              className={`w-5 h-5 transition-all ${
                isFavorited ? 'fill-red-500 text-red-500' : 'text-stone-600 group-hover/fav:text-red-500'
              } ${isLoadingFavorite ? 'animate-pulse' : ''}`}
            />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Title and Location */}
          <div>
            <Link href={`/property/${id}`}>
              <h3 className="text-xl font-bold text-stone-900 hover:text-[#1B4965] transition-colors line-clamp-1 mb-1">
                {title}
              </h3>
            </Link>
            <div className="flex items-center text-stone-500 text-sm">
              <MapPin className="w-4 h-4 mr-1.5 text-stone-400" />
              {country.charAt(0).toUpperCase() + country.slice(1).toLowerCase()}
            </div>
          </div>

          {/* Description */}
          <p className="text-stone-600 text-sm line-clamp-2 leading-relaxed">
            {description}
          </p>

          {/* Features */}
          <div className="flex items-center gap-4 text-stone-600 text-sm">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-50 rounded-lg">
              <Bed className="w-4 h-4 text-[#1B4965]" />
              <span className="font-medium">{bedrooms}</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-50 rounded-lg">
              <Bath className="w-4 h-4 text-[#1B4965]" />
              <span className="font-medium">{bathrooms}</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-50 rounded-lg">
              <Square className="w-4 h-4 text-[#1B4965]" />
              <span className="font-medium">{area} m²</span>
            </div>
          </div>

          {/* Price and Actions */}
          <div className="pt-4 border-t border-stone-200">
            <div className="flex items-end justify-between mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <div className="text-3xl font-bold text-stone-900">
                    {formatPrice(price)}
                  </div>
                  {investmentData && bestMetric > 0 && bestMetricLabel && (
                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-full">
                      {bestMetric}% {bestMetricLabel}
                    </span>
                  )}
                </div>
                <div className="text-xs text-stone-500 mt-0.5">
                  {area > 0 ? `${formatPrice(Math.round(price / area))}/m²` : ''}
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Link href={`/property/${id}`} className="flex-1">
                <Button
                  variant="outline"
                  className="w-full group/btn hover:bg-stone-50"
                >
                  View Details
                  <ArrowRight className="w-4 h-4 ml-2 group-hover/btn:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <Button
                onClick={(e) => {
                  e.stopPropagation()
                  setShowInquiryModal(true)
                }}
                className="flex-1 bg-[#1B4965] hover:bg-[#2B6985] text-white shadow-md"
              >
                <DollarSign className="w-4 h-4 mr-2" />
                Inquire Now
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Auth Modal */}
      {showAuthModal && (
        <AuthModal>
          <div />
        </AuthModal>
      )}

      {/* Inquiry Modal */}
      <Dialog open={showInquiryModal} onOpenChange={setShowInquiryModal}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Property Inquiry</DialogTitle>
            <DialogDescription className="text-base">
              Interested in "{title}"? Fill out the form below and our team will contact you within 24 hours.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onInquirySubmit)} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                {...register('name', { required: 'Name is required' })}
                placeholder="John Doe"
                className="h-11"
              />
              {errors.name && (
                <p className="text-sm text-red-600">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address *</Label>
              <Input
                id="email"
                type="email"
                {...register('email', {
                  required: 'Email is required',
                  pattern: {
                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                    message: 'Invalid email address',
                  },
                })}
                placeholder="john@example.com"
                className="h-11"
              />
              {errors.email && (
                <p className="text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                {...register('phone')}
                placeholder="+1 (555) 000-0000"
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Message (Optional)</Label>
              <Textarea
                id="message"
                {...register('message')}
                placeholder="Tell us about your investment goals or any specific questions..."
                rows={4}
                className="resize-none"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowInquiryModal(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmittingInquiry}
                className="flex-1 bg-[#1B4965] hover:bg-[#2B6985] text-white"
              >
                {isSubmittingInquiry ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full" />
                    Sending...
                  </span>
                ) : (
                  'Send Inquiry'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
