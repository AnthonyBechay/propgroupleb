export const PROPERTY_TYPES = [
  'APARTMENT', 'VILLA', 'TOWNHOUSE', 'PENTHOUSE', 'STUDIO',
  'DUPLEX', 'LAND', 'COMMERCIAL', 'OFFICE'
] as const

export const COUNTRIES = ['LEBANON'] as const
export const STATUSES = ['OFF_PLAN', 'NEW_BUILD', 'RESALE'] as const
export const CURRENCIES = ['USD', 'EUR', 'GBP', 'AED'] as const
export const FURNISHING = ['UNFURNISHED', 'SEMI_FURNISHED', 'FULLY_FURNISHED'] as const
export const OWNERSHIP = ['FREEHOLD', 'LEASEHOLD'] as const

export const AMENITY_OPTIONS = [
  { key: 'hasPool', label: 'Swimming Pool' },
  { key: 'hasGym', label: 'Gym' },
  { key: 'hasGarden', label: 'Garden' },
  { key: 'hasBalcony', label: 'Balcony' },
  { key: 'hasSecurity', label: '24/7 Security' },
  { key: 'hasElevator', label: 'Elevator' },
  { key: 'hasCentralAC', label: 'Central A/C' },
] as const
