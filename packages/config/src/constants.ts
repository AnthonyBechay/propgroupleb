export const SUPPORTED_COUNTRIES = [
  { id: 'lebanon', name: 'Lebanon' }
] as const;

// Lebanon administrative hierarchy
export const MOHAFAZAT = [
  { id: 'beirut', name: 'Beirut', cazas: ['Beirut'] },
  { id: 'mount_lebanon', name: 'Mount Lebanon', cazas: ['Baabda', 'Aley', 'Chouf', 'Metn', 'Keserwan', 'Jbeil (Byblos)'] },
  { id: 'north', name: 'North Lebanon', cazas: ['Tripoli', 'Zgharta', 'Bsharri', 'Koura', 'Batroun', 'Miniyeh-Danniyeh'] },
  { id: 'south', name: 'South Lebanon', cazas: ['Sidon (Saida)', 'Sour (Tyre)', 'Jezzine', 'Nabatieh', 'Bent Jbeil', 'Hasbaya', 'Marjeyoun'] },
  { id: 'bekaa', name: 'Bekaa', cazas: ['Zahlé', 'West Bekaa', 'Rashaya'] },
  { id: 'akkar', name: 'Akkar', cazas: ['Akkar'] },
  { id: 'baalbek_hermel', name: 'Baalbek-Hermel', cazas: ['Baalbek', 'Hermel'] },
  { id: 'nabatieh', name: 'Nabatieh', cazas: ['Nabatieh', 'Bent Jbeil', 'Hasbaya', 'Marjeyoun'] },
] as const;

export const BUILDING_KINDS = ['STANDALONE', 'PROJECT', 'COMMUNITY', 'MIXED_USE'] as const;

export const UNIT_KINDS = [
  'APARTMENT',
  'STUDIO',
  'DUPLEX',
  'PENTHOUSE',
  'VILLA',
  'TOWNHOUSE',
  'SHOP',
  'OFFICE',
  'LAND_PARCEL',
  'STORAGE',
  'PARKING',
] as const;

export const UNIT_KIND_LABELS: Record<typeof UNIT_KINDS[number], string> = {
  APARTMENT: 'Apartment',
  STUDIO: 'Studio',
  DUPLEX: 'Duplex',
  PENTHOUSE: 'Penthouse',
  VILLA: 'Villa',
  TOWNHOUSE: 'Townhouse',
  SHOP: 'Shop',
  OFFICE: 'Office',
  LAND_PARCEL: 'Land',
  STORAGE: 'Storage',
  PARKING: 'Parking',
};

export const UNIT_LIFECYCLES = [
  'DRAFT',
  'FOR_SALE',
  'RESERVED',
  'SOLD',
  'OWNER_OCCUPIED',
  'FOR_RENT',
  'RENTED',
  'VACANT',
  'OFF_MARKET',
] as const;

export const LISTING_INTENTS = ['FOR_SALE', 'FOR_RENT'] as const;

export const CURRENCIES = ['USD', 'LBP'] as const;

export const PROPERTY_STATUSES = ['OFF_PLAN', 'NEW_BUILD', 'RESALE'] as const;

export const INVESTMENT_GOALS = [
  'HIGH_ROI',
  'CAPITAL_GROWTH',
  'PASSIVE_INCOME',
  'LIFESTYLE',
] as const;

export const TICKET_CATEGORIES = [
  'PLUMBING',
  'ELECTRICAL',
  'HVAC',
  'APPLIANCE',
  'STRUCTURAL',
  'CLEANING',
  'PEST',
  'KEYS_LOCKS',
  'INTERNET',
  'GENERATOR',
  'ELEVATOR',
  'WATER_TANK',
  'OTHER',
] as const;

export const TICKET_CATEGORY_LABELS: Record<typeof TICKET_CATEGORIES[number], string> = {
  PLUMBING: 'Plumbing',
  ELECTRICAL: 'Electrical',
  HVAC: 'HVAC / A/C',
  APPLIANCE: 'Appliance',
  STRUCTURAL: 'Structural',
  CLEANING: 'Cleaning',
  PEST: 'Pest Control',
  KEYS_LOCKS: 'Keys & Locks',
  INTERNET: 'Internet',
  GENERATOR: 'Generator',
  ELEVATOR: 'Elevator',
  WATER_TANK: 'Water Tank',
  OTHER: 'Other',
};

export const UTILITY_KINDS = [
  'ELECTRICITY_EDL',
  'ELECTRICITY_GENERATOR',
  'WATER',
  'INTERNET',
  'GAS',
  'OTHER',
] as const;

export const UTILITY_KIND_LABELS: Record<typeof UTILITY_KINDS[number], string> = {
  ELECTRICITY_EDL: 'Electricity (EDL)',
  ELECTRICITY_GENERATOR: 'Generator',
  WATER: 'Water',
  INTERNET: 'Internet',
  GAS: 'Gas',
  OTHER: 'Other',
};

export const PAYMENT_METHODS = [
  'CASH',
  'BANK_TRANSFER',
  'OMT',
  'WHISH',
  'FRESH_USD',
  'LOLLAR',
  'OTHER',
] as const;

export const PAYMENT_METHOD_LABELS: Record<typeof PAYMENT_METHODS[number], string> = {
  CASH: 'Cash',
  BANK_TRANSFER: 'Bank Transfer',
  OMT: 'OMT',
  WHISH: 'Whish',
  FRESH_USD: 'Fresh USD',
  LOLLAR: 'Lollar',
  OTHER: 'Other',
};

export type Country = typeof SUPPORTED_COUNTRIES[number]['id'];
export type BuildingKind = typeof BUILDING_KINDS[number];
export type UnitKind = typeof UNIT_KINDS[number];
export type UnitLifecycle = typeof UNIT_LIFECYCLES[number];
export type Currency = typeof CURRENCIES[number];
export type PropertyStatus = typeof PROPERTY_STATUSES[number];
export type InvestmentGoal = typeof INVESTMENT_GOALS[number];
export type TicketCategory = typeof TICKET_CATEGORIES[number];
export type UtilityKind = typeof UTILITY_KINDS[number];
export type PaymentMethod = typeof PAYMENT_METHODS[number];
