'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Property } from '@/lib/types/api'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { updateProperty } from '@/actions/property-actions'
import { Upload, X, Image as ImageIcon, ChevronDown, ChevronUp } from 'lucide-react'
import { ImageUpload, VideoUpload } from '@/components/ui/ImageUpload'

const propertySchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  price: z.number().min(0, 'Price must be positive'),
  currency: z.string().min(3, 'Currency is required'),
  propertyType: z.enum(['APARTMENT', 'VILLA', 'TOWNHOUSE', 'PENTHOUSE', 'STUDIO', 'DUPLEX', 'LAND', 'COMMERCIAL', 'OFFICE']),
  bedrooms: z.number().min(0, 'Bedrooms must be non-negative'),
  bathrooms: z.number().min(0, 'Bathrooms must be non-negative'),
  area: z.number().min(0, 'Area must be positive'),
  country: z.enum(['GEORGIA', 'CYPRUS', 'GREECE', 'LEBANON']),
  status: z.enum(['OFF_PLAN', 'NEW_BUILD', 'RESALE']),
  isGoldenVisaEligible: z.boolean(),
  developerId: z.string().optional(),
  locationGuideId: z.string().optional(),
  expectedROI: z.number().optional(),
  rentalYield: z.number().optional(),
  capitalGrowth: z.number().optional(),
  minInvestment: z.number().optional(),
  maxInvestment: z.number().optional(),
  paymentPlan: z.string().optional(),
  completionDate: z.string().optional(),
  city: z.string().optional(),
  district: z.string().optional(),
  address: z.string().optional(),
  images: z.array(z.string()).optional(),
})

type PropertyFormData = z.infer<typeof propertySchema>

type EditPropertyModalProps = {
  property: Property | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditPropertyModal({ property, open, onOpenChange }: EditPropertyModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [currentImageUrl, setCurrentImageUrl] = useState('')
  const [showManualImageUrl, setShowManualImageUrl] = useState(false)
  const [videoUrl, setVideoUrl] = useState('')
  const [showManualVideoUrl, setShowManualVideoUrl] = useState(false)

  const form = useForm<PropertyFormData>({
    resolver: zodResolver(propertySchema),
    defaultValues: {
      title: '',
      description: '',
      price: 0,
      currency: 'USD',
      bedrooms: 0,
      bathrooms: 0,
      area: 0,
      country: 'GEORGIA',
      status: 'NEW_BUILD',
      isGoldenVisaEligible: false,
    },
  })

  // Update form values when property changes
  useEffect(() => {
    if (property) {
      form.reset({
        title: property.title || '',
        description: property.description || '',
        price: property.price || 0,
        currency: property.currency || 'USD',
        bedrooms: property.bedrooms || 0,
        bathrooms: property.bathrooms || 0,
        area: property.area || 0,
        country: property.country as any || 'GEORGIA',
        status: property.status as any || 'NEW_BUILD',
        isGoldenVisaEligible: property.isGoldenVisaEligible || false,
        developerId: property.developerId || undefined,
        locationGuideId: property.locationGuideId || undefined,
        expectedROI: property.investmentData?.expectedROI || undefined,
        rentalYield: property.investmentData?.rentalYield || undefined,
        capitalGrowth: property.investmentData?.capitalGrowth || undefined,
        minInvestment: property.investmentData?.minInvestment || undefined,
        maxInvestment: property.investmentData?.maxInvestment || undefined,
        paymentPlan: property.investmentData?.paymentPlan || undefined,
        completionDate: property.investmentData?.completionDate || undefined,
      })
      setImageUrls(property.images || [])
      setVideoUrl((property as any).videoUrl || '')
    }
  }, [property, form])

  const addImageUrl = () => {
    if (currentImageUrl && currentImageUrl.trim()) {
      setImageUrls([...imageUrls, currentImageUrl.trim()])
      setCurrentImageUrl('')
    }
  }

  const removeImageUrl = (index: number) => {
    setImageUrls(imageUrls.filter((_, i) => i !== index))
  }

  const onSubmit = async (data: PropertyFormData) => {
    if (!property) return

    setIsSubmitting(true)
    try {
      const propertyData = {
        ...data,
        images: imageUrls,
        ...(videoUrl ? { videoUrl } : { videoUrl: null }),
      }

      await updateProperty(property.id, propertyData as any)
      onOpenChange(false)
      window.location.reload()
    } catch (error) {
      console.error('Error updating property:', error)
      alert('Failed to update property. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!property) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-900">
        <DialogHeader>
          <DialogTitle>Edit Property</DialogTitle>
          <DialogDescription>
            Update the property information below.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Basic Information</h3>

                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title *</FormLabel>
                      <FormControl>
                        <Input placeholder="Property title" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description *</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Property description"
                          rows={4}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Price *</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="0"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="currency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Currency *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select currency" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="USD">USD</SelectItem>
                            <SelectItem value="EUR">EUR</SelectItem>
                            <SelectItem value="GBP">GBP</SelectItem>
                            <SelectItem value="AED">AED</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="bedrooms"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bedrooms *</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="0"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="bathrooms"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bathrooms *</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="0"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="area"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Area (m²) *</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="0"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="country"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Country *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select country" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="GEORGIA">Georgia</SelectItem>
                            <SelectItem value="CYPRUS">Cyprus</SelectItem>
                            <SelectItem value="GREECE">Greece</SelectItem>
                            <SelectItem value="LEBANON">Lebanon</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="OFF_PLAN">Off Plan</SelectItem>
                            <SelectItem value="NEW_BUILD">New Build</SelectItem>
                            <SelectItem value="RESALE">Resale</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="isGoldenVisaEligible"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2">
                      <FormControl>
                        <input
                          type="checkbox"
                          checked={field.value}
                          onChange={field.onChange}
                          className="h-4 w-4"
                        />
                      </FormControl>
                      <FormLabel className="!mt-0">Golden Visa Eligible</FormLabel>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Investment Data */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Investment Data</h3>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="expectedROI"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Expected ROI (%)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.1"
                            placeholder="0"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || undefined)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="rentalYield"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rental Yield (%)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.1"
                            placeholder="0"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || undefined)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="capitalGrowth"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Capital Growth (%)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.1"
                          placeholder="0"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || undefined)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="minInvestment"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Min Investment</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="0"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || undefined)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="maxInvestment"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Max Investment</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="0"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || undefined)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="paymentPlan"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Plan</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="e.g., 30% down payment, 70% on completion"
                          rows={2}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="completionDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Completion Date</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Image Upload Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Property Images</h3>

              <ImageUpload
                value={imageUrls}
                onChange={setImageUrls}
                maxFiles={10}
                disabled={isSubmitting}
              />

              {/* Manual URL fallback */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowManualImageUrl(!showManualImageUrl)}
                  className="text-xs text-slate-400 hover:text-cyan-400 flex items-center gap-1 transition-colors"
                >
                  {showManualImageUrl ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  Or add URL manually
                </button>
                {showManualImageUrl && (
                  <div className="flex gap-2 mt-2">
                    <Input
                      placeholder="Enter image URL"
                      value={currentImageUrl}
                      onChange={(e) => setCurrentImageUrl(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          addImageUrl()
                        }
                      }}
                    />
                    <Button type="button" onClick={addImageUrl} variant="outline" size="sm">
                      <Upload className="h-4 w-4 mr-1" />
                      Add
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Video Upload Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Property Video</h3>

              <VideoUpload
                value={videoUrl}
                onChange={setVideoUrl}
                disabled={isSubmitting}
              />

              {/* Manual video URL fallback */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowManualVideoUrl(!showManualVideoUrl)}
                  className="text-xs text-slate-400 hover:text-cyan-400 flex items-center gap-1 transition-colors"
                >
                  {showManualVideoUrl ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  Or add video URL manually
                </button>
                {showManualVideoUrl && (
                  <div className="flex gap-2 mt-2">
                    <Input
                      placeholder="Enter video URL"
                      value={videoUrl}
                      onChange={(e) => setVideoUrl(e.target.value)}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end space-x-4 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Updating...' : 'Update Property'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
