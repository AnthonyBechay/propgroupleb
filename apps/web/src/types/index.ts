// Core Types for PropGroup Application
// Generated from Prisma Schema

// ============================================
// ENUMS
// ============================================

export enum Country {
  LEBANON = 'LEBANON',
}

export enum PropertyStatus {
  OFF_PLAN = 'OFF_PLAN',
  NEW_BUILD = 'NEW_BUILD',
  RESALE = 'RESALE',
}

export enum PropertyType {
  APARTMENT = 'APARTMENT',
  VILLA = 'VILLA',
  TOWNHOUSE = 'TOWNHOUSE',
  PENTHOUSE = 'PENTHOUSE',
  STUDIO = 'STUDIO',
  DUPLEX = 'DUPLEX',
  LAND = 'LAND',
  COMMERCIAL = 'COMMERCIAL',
  OFFICE = 'OFFICE',
}

export enum PropertyAvailabilityStatus {
  AVAILABLE = 'AVAILABLE',
  RESERVED = 'RESERVED',
  SOLD = 'SOLD',
  OFF_MARKET = 'OFF_MARKET',
}

export enum PropertyVisibility {
  PUBLIC = 'PUBLIC',
  ELITE_ONLY = 'ELITE_ONLY',
  HIDDEN = 'HIDDEN',
}

export enum FurnishingStatus {
  UNFURNISHED = 'UNFURNISHED',
  SEMI_FURNISHED = 'SEMI_FURNISHED',
  FULLY_FURNISHED = 'FULLY_FURNISHED',
}

export enum OwnershipType {
  FREEHOLD = 'FREEHOLD',
  LEASEHOLD = 'LEASEHOLD',
}

export enum InvestmentGoal {
  HIGH_ROI = 'HIGH_ROI',
  CAPITAL_GROWTH = 'CAPITAL_GROWTH',
  GOLDEN_VISA = 'GOLDEN_VISA',
  PASSIVE_INCOME = 'PASSIVE_INCOME',
  LIFESTYLE = 'LIFESTYLE',
}

export enum Role {
  USER = 'USER',
  AGENT = 'AGENT',
  ADMIN = 'ADMIN',
  SUPER_ADMIN = 'SUPER_ADMIN',
}

export enum MembershipTier {
  FREE = 'FREE',
  ELITE = 'ELITE',
  PREMIUM = 'PREMIUM',
}

export enum ReviewStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum NotificationType {
  PROPERTY_UPDATE = 'PROPERTY_UPDATE',
  NEW_MATCHING_PROPERTY = 'NEW_MATCHING_PROPERTY',
  INQUIRY_RESPONSE = 'INQUIRY_RESPONSE',
  PORTFOLIO_ALERT = 'PORTFOLIO_ALERT',
  SYSTEM = 'SYSTEM',
}

export enum NotificationPriority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

// ============================================
// USER TYPES
// ============================================

export interface User {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  country?: string | null;
  role: Role;
  membershipTier: MembershipTier;
  membershipStartDate?: Date | null;
  membershipEndDate?: Date | null;
  investmentGoals: InvestmentGoal[];
  isActive: boolean;
  emailVerifiedAt?: Date | null;
  bannedAt?: Date | null;
  bannedBy?: string | null;
  bannedReason?: string | null;
  lastLoginAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;

  // Agent specific fields
  agentLicenseNumber?: string | null;
  agentCompany?: string | null;
  agentBio?: string | null;
  agentCommissionRate?: number | null;
}

export interface UserWithCounts extends User {
  _count: {
    favoriteProperties: number;
    propertyInquiries: number;
    ownedProperties: number;
  };
}

// ============================================
// PROPERTY TYPES
// ============================================

export interface PropertyInvestmentData {
  id: string;
  propertyId: string;
  expectedROI?: number | null;
  rentalYield?: number | null;
  capitalGrowth?: number | null;
  annualAppreciation?: number | null;
  isGoldenVisaEligible: boolean;
  goldenVisaMinAmount?: number | null;
  minInvestment?: number | null;
  maxInvestment?: number | null;
  downPaymentPercentage?: number | null;
  paymentPlan?: string | null;
  installmentYears?: number | null;
  completionDate?: Date | null;
  handoverDate?: Date | null;
  expectedRentalStart?: Date | null;
  averageRentPerMonth?: number | null;
  mortgageAvailable: boolean;
  serviceFee?: number | null;
  propertyTax?: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Developer {
  id: string;
  name: string;
  description?: string | null;
  logo?: string | null;
  website?: string | null;
  country?: Country | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface LocationGuide {
  id: string;
  title: string;
  content: string;
  country: Country;
  imageUrl?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Property {
  id: string;
  title: string;
  shortDescription?: string | null;
  description: string;
  slug?: string | null;

  // Type & Classification
  propertyType: PropertyType;

  // Pricing
  price: number;
  currency: string;

  // Physical Details
  bedrooms: number;
  bathrooms: number;
  area: number;
  builtYear?: number | null;
  floor?: number | null;
  floors?: number | null;
  parkingSpaces?: number | null;

  // Location
  country: Country;
  city?: string | null;
  district?: string | null;
  address?: string | null;
  zipCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;

  // Status
  status: PropertyStatus;
  availabilityStatus: PropertyAvailabilityStatus;
  visibility: PropertyVisibility;

  // Features
  furnishingStatus?: FurnishingStatus | null;
  ownershipType?: OwnershipType | null;
  isGoldenVisaEligible: boolean;
  hasPool: boolean;
  hasGym: boolean;
  hasGarden: boolean;
  hasBalcony: boolean;
  hasSecurity: boolean;
  hasElevator: boolean;
  hasCentralAC: boolean;

  // Media
  images: string[];
  videoUrl?: string | null;
  virtualTourUrl?: string | null;

  // SEO & Marketing
  metaTitle?: string | null;
  metaDescription?: string | null;
  featured: boolean;
  featuredUntil?: Date | null;
  highlightedFeatures: string[];

  // Analytics
  views: number;

  // Dates
  publishedAt?: Date | null;
  reservedUntil?: Date | null;
  createdAt: Date;
  updatedAt: Date;

  // Foreign Keys
  developerId?: string | null;
  locationGuideId?: string | null;
  agentId?: string | null;
}

export interface PropertyWithRelations extends Property {
  developer?: Developer | null;
  locationGuide?: LocationGuide | null;
  investmentData?: PropertyInvestmentData | null;
  agent?: Partial<User> | null;
  amenities?: PropertyAmenity[];
  tags?: PropertyTagWithTag[];
  reviews?: PropertyReviewWithUser[];
  _count?: {
    favoriteProperties: number;
    propertyInquiries: number;
    reviews: number;
  };
}

export interface PropertyAmenity {
  id: string;
  propertyId: string;
  name: string;
  category?: string | null;
  description?: string | null;
  icon?: string | null;
  createdAt: Date;
}

export interface Tag {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  category?: string | null;
  color?: string | null;
  icon?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PropertyTag {
  propertyId: string;
  tagId: string;
  assignedAt: Date;
}

export interface PropertyTagWithTag extends PropertyTag {
  tag: Tag;
}

// ============================================
// INTERACTION TYPES
// ============================================

export interface FavoriteProperty {
  id: string;
  userId: string;
  propertyId: string;
  createdAt: Date;
}

export interface FavoritePropertyWithProperty extends FavoriteProperty {
  property: PropertyWithRelations;
}

export interface PropertyInquiry {
  id: string;
  propertyId: string;
  userId?: string | null;
  name: string;
  email: string;
  phone?: string | null;
  message?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PropertyInquiryWithRelations extends PropertyInquiry {
  property: Property | PropertyWithRelations;
  user?: Partial<User> | null;
}

export interface PropertyReview {
  id: string;
  propertyId: string;
  userId: string;
  rating: number;
  title?: string | null;
  review: string;
  locationRating?: number | null;
  valueRating?: number | null;
  qualityRating?: number | null;
  amenitiesRating?: number | null;
  isVerifiedPurchase: boolean;
  status: ReviewStatus;
  moderatedAt?: Date | null;
  moderatedBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PropertyReviewWithUser extends PropertyReview {
  user: Partial<User>;
}

export interface UserOwnedProperty {
  id: string;
  userId: string;
  propertyId?: string | null;
  customName: string;
  purchasePrice: number;
  purchaseDate: Date;
  initialMortgage?: number | null;
  currentRent?: number | null;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserOwnedPropertyWithRelations extends UserOwnedProperty {
  property?: PropertyWithRelations | null;
}

// ============================================
// NOTIFICATION TYPES
// ============================================

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string | null;
  actionLabel?: string | null;
  actionUrl?: string | null;
  isRead: boolean;
  readAt?: Date | null;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  priority: NotificationPriority;
  createdAt: Date;
}

// ============================================
// ADMIN TYPES
// ============================================

export interface AdminAuditLog {
  id: string;
  adminId: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  details?: any | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: Date;
}

export interface AdminAuditLogWithAdmin extends AdminAuditLog {
  admin: Partial<User>;
}

export interface MembershipBenefit {
  id: string;
  tier: MembershipTier;
  name: string;
  description?: string | null;
  icon?: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  details?: any;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// ============================================
// FORM TYPES
// ============================================

export interface RegisterFormData {
  email: string;
  password: string;
  confirmPassword?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  country?: string;
  investmentGoals?: InvestmentGoal[];
}

export interface LoginFormData {
  email: string;
  password: string;
}

export interface PropertyFormData extends Omit<Property, 'id' | 'createdAt' | 'updatedAt' | 'slug' | 'views' | 'publishedAt'> {
  // Investment data fields
  expectedROI?: number;
  rentalYield?: number;
  capitalGrowth?: number;
  annualAppreciation?: number;
  minInvestment?: number;
  maxInvestment?: number;
  downPaymentPercentage?: number;
  paymentPlan?: string;
  installmentYears?: number;
  completionDate?: string | Date;
  handoverDate?: string | Date;
  expectedRentalStart?: string | Date;
  averageRentPerMonth?: number;
  mortgageAvailable?: boolean;
  serviceFee?: number;
  propertyTax?: number;
  goldenVisaMinAmount?: number;
}

export interface PropertySearchParams {
  page?: number;
  limit?: number;
  country?: string;
  city?: string;
  propertyType?: string;
  status?: string;
  availabilityStatus?: string;
  visibility?: string;
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number;
  minBedrooms?: number;
  maxBedrooms?: number;
  isGoldenVisaEligible?: boolean;
  featured?: boolean;
  hasPool?: boolean;
  furnishingStatus?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface InquiryFormData {
  propertyId: string;
  name: string;
  email: string;
  phone?: string;
  message?: string;
}

export interface PortfolioFormData {
  customName: string;
  purchasePrice: number;
  purchaseDate: string | Date;
  initialMortgage?: number;
  currentRent?: number;
  notes?: string;
  propertyId?: string;
}

// ============================================
// DASHBOARD/STATS TYPES
// ============================================

export interface PortfolioStats {
  totalProperties: number;
  totalInvestment: number;
  totalMortgage: number;
  totalRent: number;
  averageROI: number;
  netWorth: number;
}

export interface AdminDashboardStats {
  overview: {
    totalUsers: number;
    totalProperties: number;
    totalInquiries: number;
    totalFavorites: number;
  };
  recent: {
    users: Partial<User>[];
    inquiries: PropertyInquiryWithRelations[];
  };
  statistics: {
    usersByRole: { role: Role; _count: { role: number } }[];
    propertiesByCountry: { country: Country; _count: { country: number } }[];
  };
}

// ============================================
// NEWSLETTER TYPES
// ============================================

export interface NewsletterSubscription {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  isActive: boolean;
  preferences?: any | null;
  subscribedAt: Date;
  unsubscribedAt?: Date | null;
}

export interface ExchangeRate {
  id: string;
  baseCurrency: string;
  targetCurrency: string;
  rate: number;
  source?: string | null;
  validFrom: Date;
  validUntil?: Date | null;
  createdAt: Date;
}
