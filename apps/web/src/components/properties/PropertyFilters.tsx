'use client'

import { useState } from 'react'
import {
  DollarSign,
  Home,
  MapPin,
  Bed,
  Bath,
  Square,
  X,
  ChevronDown,
  BadgeCheck
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface PropertyFiltersProps {
  filters: any
  onChange: (filters: any) => void
  onClose: () => void
}

const countries = [
  { value: 'GEORGIA', label: 'Georgia', flag: '\u{1F1EC}\u{1F1EA}' },
  { value: 'CYPRUS', label: 'Cyprus', flag: '\u{1F1E8}\u{1F1FE}' },
  { value: 'GREECE', label: 'Greece', flag: '\u{1F1EC}\u{1F1F7}' },
  { value: 'LEBANON', label: 'Lebanon', flag: '\u{1F1F1}\u{1F1E7}' },
]

const propertyTypes = [
  { value: 'APARTMENT', label: 'Apartment', icon: '\u{1F3E2}' },
  { value: 'VILLA', label: 'Villa', icon: '\u{1F3E1}' },
  { value: 'PENTHOUSE', label: 'Penthouse', icon: '\u{1F3D9}\u{FE0F}' },
  { value: 'TOWNHOUSE', label: 'Townhouse', icon: '\u{1F3D8}\u{FE0F}' },
  { value: 'STUDIO', label: 'Studio', icon: '\u{1F3E0}' },
  { value: 'DUPLEX', label: 'Duplex', icon: '\u{1F3D8}\u{FE0F}' },
  { value: 'COMMERCIAL', label: 'Commercial', icon: '\u{1F3EA}' },
  { value: 'OFFICE', label: 'Office', icon: '\u{1F3E2}' },
  { value: 'LAND', label: 'Land', icon: '\u{1F3DE}\u{FE0F}' },
]

const statusOptions = [
  { value: 'OFF_PLAN', label: 'Off Plan' },
  { value: 'NEW_BUILD', label: 'New Build' },
  { value: 'RESALE', label: 'Resale' },
]

export function PropertyFilters({ filters, onChange, onClose }: PropertyFiltersProps) {
  const [localFilters, setLocalFilters] = useState(filters)
  const [priceRange, setPriceRange] = useState([
    filters.minPrice ? parseInt(filters.minPrice) / 1000 : 0,
    filters.maxPrice ? parseInt(filters.maxPrice) / 1000 : 5000
  ])

  const handleFilterChange = (key: string, value: any) => {
    const newFilters = { ...localFilters, [key]: value }
    setLocalFilters(newFilters)
  }

  const handlePriceChange = (values: number[]) => {
    setPriceRange(values)
    handleFilterChange('minPrice', values[0] * 1000)
    handleFilterChange('maxPrice', values[1] * 1000)
  }

  const applyFilters = () => {
    onChange(localFilters)
    onClose()
  }

  const resetFilters = () => {
    setLocalFilters({})
    setPriceRange([0, 5000])
    onChange({})
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-slate-900">
          Filter Properties
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="p-2"
        >
          <X className="w-5 h-5" />
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Country */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-slate-500" />
            Country
          </Label>
          <Select
            value={localFilters.country}
            onValueChange={(value) => handleFilterChange('country', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select country" />
            </SelectTrigger>
            <SelectContent>
              {countries.map((country) => (
                <SelectItem key={country.value} value={country.value}>
                  <span className="flex items-center gap-2">
                    <span>{country.flag}</span>
                    <span>{country.label}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* City (free-text contains) */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-slate-500" />
            City
          </Label>
          <Input
            type="text"
            placeholder="e.g. Batumi, Tbilisi"
            value={localFilters.city || ''}
            onChange={(e) => handleFilterChange('city', e.target.value)}
          />
        </div>

        {/* Property Type */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Home className="w-4 h-4 text-slate-500" />
            Property Type
          </Label>
          <Select
            value={localFilters.propertyType}
            onValueChange={(value) => handleFilterChange('propertyType', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {propertyTypes.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  <span className="flex items-center gap-2">
                    <span>{type.icon}</span>
                    <span>{type.label}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Status */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <BadgeCheck className="w-4 h-4 text-slate-500" />
            Status
          </Label>
          <Select
            value={localFilters.status}
            onValueChange={(value) => handleFilterChange('status', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((status) => (
                <SelectItem key={status.value} value={status.value}>
                  {status.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Bedrooms */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Bed className="w-4 h-4 text-slate-500" />
            Bedrooms
          </Label>
          <Select
            value={localFilters.bedrooms}
            onValueChange={(value) => handleFilterChange('bedrooms', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Any" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1+</SelectItem>
              <SelectItem value="2">2+</SelectItem>
              <SelectItem value="3">3+</SelectItem>
              <SelectItem value="4">4+</SelectItem>
              <SelectItem value="5">5+</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Price Range - Full width */}
        <div className="space-y-2 lg:col-span-2">
          <Label className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-slate-500" />
            Price Range
          </Label>
          <div className="px-4 py-3 bg-slate-50 rounded-lg">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-slate-700">
                ${priceRange[0]}k
              </span>
              <span className="text-sm font-medium text-slate-700">
                ${priceRange[1]}k{priceRange[1] >= 5000 ? '+' : ''}
              </span>
            </div>
            <Slider
              value={priceRange}
              onValueChange={handlePriceChange}
              min={0}
              max={5000}
              step={100}
              className="w-full"
            />
          </div>
        </div>

        {/* Area Range */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Square className="w-4 h-4 text-slate-500" />
            Area (m²)
          </Label>
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="Min"
              value={localFilters.minArea || ''}
              onChange={(e) => handleFilterChange('minArea', e.target.value)}
            />
            <Input
              type="number"
              placeholder="Max"
              value={localFilters.maxArea || ''}
              onChange={(e) => handleFilterChange('maxArea', e.target.value)}
            />
          </div>
        </div>

        {/* Golden Visa */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <BadgeCheck className="w-4 h-4 text-[#C49A2E]" />
            Special Features
          </Label>
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={localFilters.isGoldenVisaEligible === 'true'}
                onChange={(e) => handleFilterChange('isGoldenVisaEligible', e.target.checked ? 'true' : '')}
                className="rounded border-slate-300 text-[#1B3A5C] focus:ring-[#1B3A5C]"
              />
              <span className="text-sm text-slate-700">
                Golden Visa Eligible
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={localFilters.highRoi === 'true'}
                onChange={(e) => handleFilterChange('highRoi', e.target.checked ? 'true' : '')}
                className="rounded border-slate-300 text-[#1B3A5C] focus:ring-[#1B3A5C]"
              />
              <span className="text-sm text-slate-700">
                High ROI (15%+)
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-200">
        <Button
          variant="ghost"
          onClick={resetFilters}
          className="text-slate-600"
        >
          Reset Filters
        </Button>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            onClick={applyFilters}
            className="bg-[#1B3A5C] hover:bg-[#24507D] text-white"
          >
            Apply Filters
          </Button>
        </div>
      </div>
    </div>
  )
}
