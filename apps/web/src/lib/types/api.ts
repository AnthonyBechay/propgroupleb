// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// User types
export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  country?: string;
  role: 'USER' | 'AGENT' | 'ADMIN' | 'SUPER_ADMIN';
  isActive: boolean;
  bannedAt?: string | null;
  emailVerifiedAt?: string | null;
  lastLoginAt?: string | null;
  createdAt: string;
  updatedAt?: string;
}

// Unit / UnitOption types
export interface UnitOption {
  id: string;
  unitId: string;
  name: string;
  pricePerSqm: number;
  currency: string;
  initialPayment?: number | null;
  paymentPlanDetails?: any;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
  // computed
  totalPrice?: number;
}

export interface Unit {
  id: string;
  propertyId: string;
  name: string;
  unitNumber?: string | null;
  /** Unit-level property type (overrides project-level when set) */
  propertyType?: 'APARTMENT' | 'VILLA' | 'TOWNHOUSE' | 'PENTHOUSE' | 'STUDIO' | 'DUPLEX' | 'LAND' | 'COMMERCIAL' | 'OFFICE' | null;
  bedrooms: number;
  bathrooms: number;
  area: number;
  floor?: number | null;
  parkingSpaces?: number | null;
  notes?: string | null;
  images: string[];
  availabilityStatus: 'AVAILABLE' | 'RESERVED' | 'SOLD' | 'OFF_MARKET';
  options: UnitOption[];
  createdAt: string;
  updatedAt: string;
}

export interface PropertyDocument {
  id: string;
  propertyId: string;
  unitId?: string | null;
  unitOptionId?: string | null;
  title: string;
  description?: string | null;
  type: 'FLOOR_PLAN' | 'BROCHURE' | 'CONTRACT' | 'LEGAL_DOCUMENT' | 'CERTIFICATE' | 'OTHER';
  fileUrl: string;
  fileSize?: number | null;
  mimeType?: string | null;
  isPublic: boolean;
  createdAt: string;
}

// Comparator types
export interface ComparatorItem {
  propertyId: string;
  propertyTitle: string;
  propertySlug: string;
  propertyCountry: string;
  propertyCity?: string | null;
  propertyStatus: string;
  propertyType: string;
  unitId: string;
  unitName: string;
  bedrooms: number;
  bathrooms: number;
  area: number;
  floor?: number | null;
  optionId: string;
  optionName: string;
  totalPrice: number;
  pricePerSqm: number;
  currency: string;
  initialPayment?: number | null;
  paymentPlanDetails?: PaymentPlanDetails | null;
}

export interface PaymentPlanDetails {
  planType?: string;
  summary?: string;
  installmentMonths?: number;
  totalInstallments?: number;
  installmentFrequency?: string; // monthly, quarterly, yearly, semi-annual
  installmentAmount?: number;
  postHandoverMonths?: number;
  postHandoverPercentage?: number;
  notes?: string;
  milestones?: Array<{
    percentage: number;
    label: string;
    description?: string;
    dueDate?: string;
    type?: 'upfront' | 'installment' | 'handover';
  }>;
}

// Property types
export interface Property {
  id: string;
  slug?: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  propertyType: 'APARTMENT' | 'VILLA' | 'TOWNHOUSE' | 'PENTHOUSE' | 'STUDIO' | 'DUPLEX' | 'LAND' | 'COMMERCIAL' | 'OFFICE';
  bedrooms?: number;
  bathrooms?: number;
  area?: number;
  areaUnit?: string;
  location?: string;
  city?: string;
  state?: string;
  country: string;
  zipCode?: string;
  latitude?: number;
  longitude?: number;
  images?: string[];
  features?: string[];
  amenities?: string[];
  nearbyFacilities?: string;
  yearBuilt?: number;
  parkingSpaces?: number;
  views?: number;
  isActive?: boolean;
  isFeatured?: boolean;
  // Additional properties from backend
  status?: 'OFF_PLAN' | 'NEW_BUILD' | 'RESALE';
  availabilityStatus?: 'AVAILABLE' | 'RESERVED' | 'SOLD' | 'OFF_MARKET';
  visibility?: 'PUBLIC' | 'ELITE_ONLY' | 'HIDDEN';
  isGoldenVisaEligible?: boolean;
  developerId?: string;
  locationGuideId?: string;
  agentId?: string;
  agent?: User;
  investmentData?: {
    expectedROI?: number | null;
    rentalYield?: number | null;
    capitalGrowth?: number | null;
    minInvestment?: number | null;
    maxInvestment?: number | null;
    paymentPlan?: string | null;
    completionDate?: string | null;
    handoverDate?: string | null;
    expectedRentalStart?: string | null;
    isGoldenVisaEligible?: boolean;
    goldenVisaMinAmount?: number | null;
    serviceFee?: number | null;
    propertyTax?: number | null;
    averageRentPerMonth?: number | null;
    downPaymentPercentage?: number | null;
    annualAppreciation?: number | null;
    mortgageAvailable?: boolean;
  };
  developer?: {
    id: string;
    name: string;
  };
  locationGuide?: {
    id: string;
    title: string;
  };
  createdAt: string;
  updatedAt?: string;
  _count?: {
    propertyInquiries?: number;
    favoriteProperties?: number;
  };
  favoriteProperties?: any[];
  units?: Unit[];
  documents?: PropertyDocument[];
}

// Portfolio types
export interface OwnedProperty {
  id: string;
  customName: string;
  purchasePrice: number;
  purchaseDate: string;
  initialMortgage?: number;
  currentRent?: number;
  notes?: string;
  propertyId?: string;
  property?: Property;
  userId: string;
  user?: User;
  createdAt: string;
  updatedAt: string;
}

// Inquiry types
export interface Inquiry {
  id: string;
  name: string;
  email: string;
  phone?: string;
  message?: string;
  propertyId?: string;
  property?: Property;
  userId?: string;
  user?: User;
  status: 'PENDING' | 'CONTACTED' | 'INTERESTED' | 'NOT_INTERESTED';
  createdAt: string;
  updatedAt: string;
}

// Dashboard stats types
export interface DashboardStats {
  totalProperties: number;
  totalInquiries: number;
  totalViews: number;
  estimatedCommission: number;
  recentInquiries: Inquiry[];
  topProperties: Property[];
}

export interface AgentDashboardStats {
  totalProperties: number;
  totalInquiries: number;
  totalViews: number;
  estimatedCommission: number;
  recentInquiries: Inquiry[];
  topProperties: Property[];
}

export interface AdminDashboardStats {
  totalUsers: number;
  totalProperties: number;
  totalInquiries: number;
  totalRevenue: number;
  recentProperties: Property[];
  recentUsers: User[];
}

// Form validation types
export interface LoginFormData {
  email: string;
  password: string;
}

export interface SignupFormData {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
}

export interface ContactFormData {
  email: string;
  name: string;
  phone?: string;
  propertyId?: string;
  message?: string;
}

export interface ProfileFormData {
  firstName: string;
  lastName: string;
  phone?: string;
  country?: string;
}

export interface PasswordFormData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface PropertyFormData {
  title: string;
  description: string;
  price: number;
  currency: string;
  propertyType: 'APARTMENT' | 'VILLA' | 'TOWNHOUSE' | 'PENTHOUSE' | 'STUDIO' | 'DUPLEX' | 'LAND' | 'COMMERCIAL' | 'OFFICE';
  bedrooms?: number;
  bathrooms?: number;
  area?: number;
  areaUnit?: string;
  location: string;
  city: string;
  state: string;
  country: string;
  zipCode?: string;
  latitude?: number;
  longitude?: number;
  images?: string[];
  features?: string[];
  amenities?: string[];
  nearbyFacilities?: string;
  yearBuilt?: number;
  parkingSpaces?: number;
  isActive?: boolean;
  isFeatured?: boolean;
}

export interface PortfolioFormData {
  customName: string;
  purchasePrice: number;
  purchaseDate: string;
  initialMortgage?: number;
  currentRent?: number;
  notes?: string;
  propertyId?: string;
}

export interface InviteAdminFormData {
  email: string;
  role: 'ADMIN' | 'SUPER_ADMIN';
}

// Calculator types
export interface CalculatorFormData {
  downPaymentPercent: number;
  interestRate: number;
  loanTermYears: number;
  propertyPrice: number;
}
