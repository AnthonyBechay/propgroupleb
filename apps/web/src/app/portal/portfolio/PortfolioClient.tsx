'use client'

import { useState } from 'react'
import { 
  Plus, 
  Edit2, 
  Trash2, 
  TrendingUp, 
  DollarSign,
  Calendar,
  Home,
  FileText,
  PieChart,
  Download,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  MapPin
} from 'lucide-react'
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

interface PortfolioItem {
  id: string
  customName: string
  propertyId: string
  purchasePrice: number
  currentValue: number
  purchaseDate: string
  location: string
  currentRent: number
  monthlyExpenses: number
  roi: number
  appreciation: number
  type: string
  status: string
}

interface PortfolioClientProps {
  initialPortfolio: PortfolioItem[]
}

export function PortfolioClient({ initialPortfolio }: PortfolioClientProps) {
  const [portfolio, setPortfolio] = useState(initialPortfolio)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingProperty, setEditingProperty] = useState<PortfolioItem | null>(null)
  const [filterStatus, setFilterStatus] = useState('all')
  const [sortBy, setSortBy] = useState('purchaseDate')

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm()

  // Calculate portfolio totals
  const totals = portfolio.reduce((acc, property) => {
    acc.totalInvestment += property.purchasePrice
    acc.totalValue += property.currentValue
    acc.totalMonthlyIncome += property.currentRent
    acc.totalMonthlyExpenses += property.monthlyExpenses
    return acc
  }, {
    totalInvestment: 0,
    totalValue: 0,
    totalMonthlyIncome: 0,
    totalMonthlyExpenses: 0
  })

  const totalAppreciation = totals.totalInvestment > 0 
    ? ((totals.totalValue - totals.totalInvestment) / totals.totalInvestment) * 100 
    : 0
  const netMonthlyIncome = totals.totalMonthlyIncome - totals.totalMonthlyExpenses
  const annualNetIncome = netMonthlyIncome * 12
  const overallROI = totals.totalInvestment > 0 
    ? (annualNetIncome / totals.totalInvestment) * 100 
    : 0

  // Filter and sort portfolio
  const filteredPortfolio = portfolio
    .filter(p => filterStatus === 'all' || p.status === filterStatus)
    .sort((a, b) => {
      switch(sortBy) {
        case 'value':
          return b.currentValue - a.currentValue
        case 'roi':
          return b.roi - a.roi
        case 'purchaseDate':
          return new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime()
        default:
          return 0
      }
    })

  const handleAddProperty = (data: any) => {
    const newProperty = {
      id: Date.now().toString(),
      ...data,
      currentValue: data.purchasePrice,
      roi: calculateROI(data.currentRent, data.monthlyExpenses, data.purchasePrice),
      appreciation: 0,
      status: data.currentRent > 0 ? 'Rented' : 'Vacant'
    }
    
    setPortfolio([...portfolio, newProperty])
    toast({
      title: 'Property added!',
      description: 'Your property has been added to your portfolio.',
    })
    setShowAddModal(false)
    reset()
  }

  const handleEditProperty = (data: any) => {
    const updated = portfolio.map(p => 
      p.id === editingProperty?.id 
        ? { 
            ...p, 
            ...data,
            roi: calculateROI(data.currentRent, data.monthlyExpenses, data.purchasePrice)
          }
        : p
    )
    setPortfolio(updated)
    toast({
      title: 'Property updated!',
      description: 'Your property details have been updated.',
    })
    setEditingProperty(null)
    reset()
  }

  const handleDeleteProperty = (id: string) => {
    setPortfolio(portfolio.filter(p => p.id !== id))
    toast({
      title: 'Property removed',
      description: 'The property has been removed from your portfolio.',
    })
  }

  const calculateROI = (rent: number, expenses: number, price: number) => {
    if (price === 0) return 0
    const netIncome = (rent - expenses) * 12
    return (netIncome / price) * 100
  }

  const openEditModal = (property: PortfolioItem) => {
    setEditingProperty(property)
    Object.keys(property).forEach(key => {
      setValue(key as any, property[key as keyof PortfolioItem])
    })
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-7xl mx-auto p-4 md:p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-stone-900 mb-2">
                My Portfolio
              </h1>
              <p className="text-stone-600">
                Track and manage your real estate investments
              </p>
            </div>
            <div className="flex gap-2 mt-4 md:mt-0">
              <Button
                onClick={() => setShowAddModal(true)}
                className="bg-[#1B4965] hover:bg-[#2B6985]"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Property
              </Button>
              <Button variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </div>

        {/* Portfolio Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <SummaryCard
            icon={<DollarSign className="w-6 h-6" />}
            title="Total Investment"
            value={`$${totals.totalInvestment.toLocaleString()}`}
            subtitle="Across all properties"
            color="blue"
          />
          <SummaryCard
            icon={<TrendingUp className="w-6 h-6" />}
            title="Current Value"
            value={`$${totals.totalValue.toLocaleString()}`}
            subtitle={`+${totalAppreciation.toFixed(1)}% appreciation`}
            color="green"
            trend={totalAppreciation}
          />
          <SummaryCard
            icon={<Home className="w-6 h-6" />}
            title="Net Monthly Income"
            value={`$${netMonthlyIncome.toLocaleString()}`}
            subtitle={`${overallROI.toFixed(1)}% annual ROI`}
            color="purple"
          />
          <SummaryCard
            icon={<PieChart className="w-6 h-6" />}
            title="Properties"
            value={portfolio.length}
            subtitle={`${portfolio.filter(p => p.status === 'Rented').length} rented`}
            color="orange"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-6">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 bg-white border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4965]"
          >
            <option value="all">All Properties</option>
            <option value="Rented">Rented</option>
            <option value="Vacant">Vacant</option>
            <option value="Under Construction">Under Construction</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-4 py-2 bg-white border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4965]"
          >
            <option value="purchaseDate">Sort by Date</option>
            <option value="value">Sort by Value</option>
            <option value="roi">Sort by ROI</option>
          </select>
        </div>

        {/* Properties Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredPortfolio.map((property) => (
            <PropertyCard
              key={property.id}
              property={property}
              onEdit={() => openEditModal(property)}
              onDelete={() => handleDeleteProperty(property.id)}
            />
          ))}
        </div>

        {/* Empty State */}
        {filteredPortfolio.length === 0 && (
          <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
            <Home className="w-16 h-16 text-stone-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-stone-900 mb-2">
              {portfolio.length === 0 
                ? "No properties in your portfolio" 
                : "No properties match your filters"
              }
            </h3>
            <p className="text-stone-600 mb-6">
              {portfolio.length === 0 
                ? "Start building your portfolio by adding your first property"
                : "Try adjusting your filters to see more properties"
              }
            </p>
            {portfolio.length === 0 && (
              <Button
                onClick={() => setShowAddModal(true)}
                className="bg-[#1B4965] hover:bg-[#2B6985]"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Property
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Add/Edit Property Modal */}
      <Dialog open={showAddModal || !!editingProperty} onOpenChange={(open) => {
        if (!open) {
          setShowAddModal(false)
          setEditingProperty(null)
          reset()
        }
      }}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingProperty ? 'Edit Property' : 'Add Property to Portfolio'}
            </DialogTitle>
            <DialogDescription>
              {editingProperty ? 'Update your property details' : 'Add a property you own to track its performance'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(editingProperty ? handleEditProperty : handleAddProperty)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="customName">Property Name *</Label>
              <Input
                id="customName"
                {...register('customName', { required: 'Property name is required' })}
                placeholder="e.g., Beach Villa Cyprus"
              />
              {errors.customName && (
                <p className="text-sm text-red-600">{String(errors.customName?.message || '')}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location *</Label>
              <Input
                id="location"
                {...register('location', { required: 'Location is required' })}
                placeholder="e.g., Limassol, Cyprus"
              />
              {errors.location && (
                <p className="text-sm text-red-600">{String(errors.location?.message || '')}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Property Type *</Label>
              <select
                id="type"
                {...register('type', { required: 'Property type is required' })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select type</option>
                <option value="Apartment">Apartment</option>
                <option value="Villa">Villa</option>
                <option value="Studio">Studio</option>
                <option value="Penthouse">Penthouse</option>
                <option value="Commercial">Commercial</option>
              </select>
              {errors.type && (
                <p className="text-sm text-red-600">{String(errors.type?.message || '')}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="purchasePrice">Purchase Price *</Label>
                <Input
                  id="purchasePrice"
                  type="number"
                  {...register('purchasePrice', { 
                    required: 'Purchase price is required',
                    min: { value: 0, message: 'Price must be positive' }
                  })}
                  placeholder="450000"
                />
                {errors.purchasePrice && (
                  <p className="text-sm text-red-600">{String(errors.purchasePrice?.message || '')}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="purchaseDate">Purchase Date *</Label>
                <Input
                  id="purchaseDate"
                  type="date"
                  {...register('purchaseDate', { required: 'Purchase date is required' })}
                />
                {errors.purchaseDate && (
                  <p className="text-sm text-red-600">{String(errors.purchaseDate?.message || '')}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="currentRent">Monthly Rent</Label>
                <Input
                  id="currentRent"
                  type="number"
                  {...register('currentRent', { min: 0 })}
                  placeholder="3200"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="monthlyExpenses">Monthly Expenses</Label>
                <Input
                  id="monthlyExpenses"
                  type="number"
                  {...register('monthlyExpenses', { min: 0 })}
                  placeholder="800"
                />
              </div>
            </div>

            {editingProperty && (
              <div className="space-y-2">
                <Label htmlFor="currentValue">Current Value</Label>
                <Input
                  id="currentValue"
                  type="number"
                  {...register('currentValue', { min: 0 })}
                  placeholder="495000"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                {...register('notes')}
                placeholder="Any additional notes about this property..."
                rows={3}
              />
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowAddModal(false)
                  setEditingProperty(null)
                  reset()
                }}
              >
                Cancel
              </Button>
              <Button type="submit" className="bg-[#1B4965] hover:bg-[#2B6985]">
                {editingProperty ? 'Update Property' : 'Add Property'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Summary Card Component
function SummaryCard({ icon, title, value, subtitle, color, trend }: any) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-[#1B4965]',
    green: 'bg-emerald-600',
    purple: 'bg-[#C97B4B]',
    orange: 'bg-stone-600',
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <div className={`${colorClasses[color] || colorClasses.blue} p-3 rounded-lg text-white`}>
          {icon}
        </div>
        {trend !== undefined && (
          trend > 0 ? <ArrowUpRight className="w-5 h-5 text-emerald-500" /> : 
          trend < 0 ? <ArrowDownRight className="w-5 h-5 text-red-500" /> : null
        )}
      </div>
      <h3 className="text-sm text-stone-600 mb-1">{title}</h3>
      <p className="text-2xl font-bold text-stone-900">{value}</p>
      <p className="text-sm text-stone-500 mt-1">{subtitle}</p>
    </div>
  )
}

// Property Card Component
function PropertyCard({ property, onEdit, onDelete }: any) {
  const netIncome = property.currentRent - property.monthlyExpenses
  const isPositive = netIncome > 0

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 hover:shadow-lg transition-all">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-stone-900">{property.customName}</h3>
          <p className="text-sm text-stone-500 flex items-center gap-1 mt-1">
            <MapPin className="w-3 h-3" />
            {property.location}
          </p>
        </div>
        <div className="flex gap-1">
          <Button
            onClick={onEdit}
            variant="ghost"
            size="sm"
            className="p-2"
          >
            <Edit2 className="w-4 h-4" />
          </Button>
          <Button
            onClick={onDelete}
            variant="ghost"
            size="sm"
            className="p-2 text-red-600 hover:text-red-700"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-xs text-stone-500">Purchase Price</p>
          <p className="text-sm font-semibold">${property.purchasePrice.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-xs text-stone-500">Current Value</p>
          <p className="text-sm font-semibold">${property.currentValue.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-xs text-stone-500">Monthly Income</p>
          <p className={`text-sm font-semibold ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
            ${netIncome.toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-xs text-stone-500">ROI</p>
          <p className="text-sm font-semibold">{property.roi.toFixed(1)}%</p>
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 border-t">
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
          property.status === 'Rented' ? 'bg-emerald-100 text-emerald-800' :
          property.status === 'Vacant' ? 'bg-red-100 text-red-800' :
          'bg-amber-100 text-amber-800'
        }`}>
          {property.status}
        </span>
        <span className="text-xs text-stone-500">
          Purchased {new Date(property.purchaseDate).toLocaleDateString()}
        </span>
      </div>
    </div>
  )
}
