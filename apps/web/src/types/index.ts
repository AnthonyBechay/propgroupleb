// Core Types for PropGroup Application
// Lebanon real estate platform

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
  PASSIVE_INCOME = 'PASSIVE_INCOME',
  LIFESTYLE = 'LIFESTYLE',
}

export enum Role {
  USER = 'USER',
  AGENT = 'AGENT',
  ADMIN = 'ADMIN',
  SUPER_ADMIN = 'SUPER_ADMIN',
  PROPERTY_MANAGER = 'PROPERTY_MANAGER',
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
// BUILDING / UNIT ENUMS
// ============================================

export enum BuildingKind {
  STANDALONE = 'STANDALONE',
  PROJECT = 'PROJECT',
  COMMUNITY = 'COMMUNITY',
  MIXED_USE = 'MIXED_USE',
}

export enum UnitKind {
  APARTMENT = 'APARTMENT',
  SHOP = 'SHOP',
  OFFICE = 'OFFICE',
  STUDIO = 'STUDIO',
  PENTHOUSE = 'PENTHOUSE',
  DUPLEX = 'DUPLEX',
  VILLA = 'VILLA',
  LAND_PARCEL = 'LAND_PARCEL',
  STORAGE = 'STORAGE',
  PARKING = 'PARKING',
}

export enum UnitLifecycle {
  DRAFT = 'DRAFT',
  FOR_SALE = 'FOR_SALE',
  RESERVED = 'RESERVED',
  SOLD = 'SOLD',
  OWNER_OCCUPIED = 'OWNER_OCCUPIED',
  FOR_RENT = 'FOR_RENT',
  RENTED = 'RENTED',
  VACANT = 'VACANT',
  OFF_MARKET = 'OFF_MARKET',
}

export enum UnitOwnership {
  PLATFORM_SOLD = 'PLATFORM_SOLD',
  EXTERNAL = 'EXTERNAL',
}

export enum ListingIntent {
  FOR_SALE = 'FOR_SALE',
  FOR_RENT = 'FOR_RENT',
}

export enum ListingStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  UNDER_OFFER = 'UNDER_OFFER',
  CLOSED = 'CLOSED',
  ARCHIVED = 'ARCHIVED',
}

export enum Currency {
  USD = 'USD',
  LBP = 'LBP',
}

// ============================================
// PROPERTY MANAGEMENT ENUMS
// ============================================

export enum TenancyStatus {
  ACTIVE = 'ACTIVE',
  NOTICE_PERIOD = 'NOTICE_PERIOD',
  ENDED = 'ENDED',
  EVICTED = 'EVICTED',
}

export enum RentPeriod {
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  ANNUALLY = 'ANNUALLY',
}

export enum RentPaymentStatus {
  DUE = 'DUE',
  PARTIAL = 'PARTIAL',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  WAIVED = 'WAIVED',
}

export enum PaymentMethod {
  CASH = 'CASH',
  BANK_TRANSFER = 'BANK_TRANSFER',
  CHEQUE = 'CHEQUE',
  WHATSAPP_PAY = 'WHATSAPP_PAY',
  OTHER = 'OTHER',
}

export enum TicketScope {
  UNIT = 'UNIT',
  BUILDING_COMMON = 'BUILDING_COMMON',
}

export enum TicketCategory {
  PLUMBING = 'PLUMBING',
  ELECTRICAL = 'ELECTRICAL',
  HVAC = 'HVAC',
  STRUCTURAL = 'STRUCTURAL',
  PEST_CONTROL = 'PEST_CONTROL',
  CLEANING = 'CLEANING',
  ELEVATOR = 'ELEVATOR',
  GENERATOR = 'GENERATOR',
  INTERNET = 'INTERNET',
  SECURITY = 'SECURITY',
  OTHER = 'OTHER',
}

export enum TicketPriority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  EMERGENCY = 'EMERGENCY',
}

export enum TicketStatus {
  OPEN = 'OPEN',
  TRIAGED = 'TRIAGED',
  SCHEDULED = 'SCHEDULED',
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED',
  CANCELLED = 'CANCELLED',
}

export enum UtilityKind {
  ELECTRICITY = 'ELECTRICITY',
  WATER = 'WATER',
  GENERATOR = 'GENERATOR',
  INTERNET = 'INTERNET',
  GAS = 'GAS',
  SEWAGE = 'SEWAGE',
  OTHER = 'OTHER',
}

export enum AllocationMethod {
  EQUAL_SPLIT = 'EQUAL_SPLIT',
  BY_AREA = 'BY_AREA',
  BY_UNIT_COUNT = 'BY_UNIT_COUNT',
  CUSTOM = 'CUSTOM',
}

export enum BillStatus {
  RECORDED = 'RECORDED',
  ALLOCATED = 'ALLOCATED',
  INVOICED = 'INVOICED',
  SETTLED = 'SETTLED',
}

export enum AllocationStatus {
  PENDING = 'PENDING',
  INVOICED = 'INVOICED',
  PAID = 'PAID',
  DISPUTED = 'DISPUTED',
}

export enum ChargeCadence {
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  ANNUALLY = 'ANNUALLY',
  ONE_OFF = 'ONE_OFF',
}

export enum ChargeStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  CANCELLED = 'CANCELLED',
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
// BUILDING / UNIT TYPES
// ============================================

export interface BuildingInvestmentData {
  id: string;
  buildingId: string;
  expectedROI?: number | null;
  rentalYield?: number | null;
  capitalGrowth?: number | null;
  annualAppreciation?: number | null;
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

export interface UnitOption {
  id: string;
  unitId: string;
  name: string;
  description?: string | null;
  images: string[];
  askingPrice?: number | null;
  askingCurrency?: Currency | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Unit {
  id: string;
  buildingId: string;
  kind: UnitKind;
  name?: string | null;
  unitNumber?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  areaSqm?: number | null;
  floor?: number | null;
  lifecycle: UnitLifecycle;
  ownershipSource?: UnitOwnership | null;
  askingPrice?: number | null;
  askingCurrency?: Currency | null;
  rentAmount?: number | null;
  rentCurrency?: Currency | null;
  rentPeriod?: RentPeriod | null;
  images: string[];
  features: string[];
  views: string[];
  options?: UnitOption[];
  building?: Building;
  createdAt: Date;
  updatedAt: Date;
}

export interface Building {
  id: string;
  kind: BuildingKind;
  title: string;
  description?: string | null;
  shortDescription?: string | null;
  mohafazat?: string | null;
  caza?: string | null;
  city?: string | null;
  neighborhood?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  images: string[];
  youtubeUrls: string[];
  virtualTourUrl?: string | null;
  status: PropertyStatus;
  visibility: PropertyVisibility;
  featured: boolean;
  slug?: string | null;
  hasGenerator: boolean;
  hasElevator: boolean;
  hasPool: boolean;
  hasGym: boolean;
  hasSecurity: boolean;
  hasConcierge: boolean;
  hasSolarPower: boolean;
  hasRooftop: boolean;
  hasGarden: boolean;
  investmentData?: BuildingInvestmentData | null;
  developer?: Developer | null;
  agent?: Partial<User> | null;
  units?: Unit[];
  tags?: BuildingTagWithTag[];
  amenities?: BuildingAmenity[];
  _count?: {
    favorites: number;
    inquiries: number;
    units: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface BuildingAmenity {
  id: string;
  buildingId: string;
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

export interface BuildingTag {
  buildingId: string;
  tagId: string;
  assignedAt: Date;
}

export interface BuildingTagWithTag extends BuildingTag {
  tag: Tag;
}

// ============================================
// LISTING TYPES
// ============================================

export interface Listing {
  id: string;
  subjectType: 'BUILDING' | 'UNIT';
  buildingId?: string | null;
  unitId?: string | null;
  intent: ListingIntent;
  status: ListingStatus;
  price: number;
  currency: Currency;
  rentPeriod?: RentPeriod | null;
  slug: string;
  headline?: string | null;
  description?: string | null;
  highlights: string[];
  publishedAt?: Date | null;
  building?: Building | null;
  unit?: Unit | null;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// PROPERTY MANAGEMENT TYPES
// ============================================

export interface Tenancy {
  id: string;
  unitId: string;
  tenantName: string;
  tenantPhone?: string | null;
  tenantEmail?: string | null;
  tenantWhatsapp?: string | null;
  startDate: Date | string;
  endDate?: Date | string | null;
  rentAmount: number;
  rentCurrency: Currency;
  rentPeriod: RentPeriod;
  depositAmount?: number | null;
  status: TenancyStatus;
  unit?: Unit & { building?: Building };
  payments?: RentPayment[];
  createdAt: Date;
  updatedAt: Date;
}

export interface RentPayment {
  id: string;
  tenancyId: string;
  dueDate: Date | string;
  paidDate?: Date | string | null;
  amount: number;
  currency: Currency;
  method?: PaymentMethod | null;
  status: RentPaymentStatus;
  receiptFileKey?: string | null;
  tenancy?: Tenancy;
  createdAt: Date;
  updatedAt: Date;
}

export interface TicketUpdate {
  id: string;
  ticketId: string;
  body: string;
  statusTo?: TicketStatus | null;
  authorId?: string | null;
  author?: Partial<User> | null;
  createdAt: Date;
}

export interface Vendor {
  id: string;
  name: string;
  trades: string[];
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MaintenanceTicket {
  id: string;
  buildingId: string;
  unitId?: string | null;
  scope: TicketScope;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  title: string;
  description?: string | null;
  reporterName?: string | null;
  vendorId?: string | null;
  assignedToUserId?: string | null;
  costEstimate?: number | null;
  costActual?: number | null;
  resolvedAt?: Date | null;
  building?: Building;
  unit?: Unit | null;
  vendor?: Vendor | null;
  assignedTo?: Partial<User> | null;
  updates?: TicketUpdate[];
  createdAt: Date;
  updatedAt: Date;
}

export interface UtilityMeter {
  id: string;
  buildingId: string;
  unitId?: string | null;
  kind: UtilityKind;
  identifier?: string | null;
  isActive: boolean;
  building?: Building;
  unit?: Unit | null;
  readings?: UtilityReading[];
  createdAt: Date;
  updatedAt: Date;
}

export interface UtilityReading {
  id: string;
  meterId: string;
  readingAt: Date | string;
  value: number;
  photoKey?: string | null;
  meter?: UtilityMeter;
  createdAt: Date;
}

export interface BillAllocation {
  id: string;
  billId: string;
  unitId: string;
  method: AllocationMethod;
  share: number;
  amount: number;
  currency: Currency;
  status: AllocationStatus;
  unit?: Unit;
  createdAt: Date;
  updatedAt: Date;
}

export interface UtilityBill {
  id: string;
  buildingId: string;
  kind: UtilityKind;
  periodStart: Date | string;
  periodEnd: Date | string;
  totalAmount: number;
  currency: Currency;
  status: BillStatus;
  allocations?: BillAllocation[];
  building?: Building;
  createdAt: Date;
  updatedAt: Date;
}

export interface ServiceCharge {
  id: string;
  buildingId: string;
  name: string;
  amount: number;
  currency: Currency;
  cadence: ChargeCadence;
  splitMethod: AllocationMethod;
  isActive: boolean;
  building?: Building;
  createdAt: Date;
  updatedAt: Date;
}

export interface UnitExpenseShare {
  unitId: string;
  unitNumber?: string | null;
  kind: UnitKind;
  share: number;
  amount: number;
  currency: Currency;
}

export interface BuildingExpense {
  id: string;
  buildingId: string;
  category: string;
  description?: string | null;
  amount: number;
  currency: Currency;
  date: Date | string;
  vendorId?: string | null;
  vendor?: Vendor | null;
  createdAt: Date;
}

export interface FxRate {
  id: string;
  date: Date | string;
  usdToLbp: number;
  source?: string | null;
  createdAt: Date;
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

export interface PropertyInquiry {
  id: string;
  propertyId?: string | null;
  buildingId?: string | null;
  listingId?: string | null;
  userId?: string | null;
  name: string;
  email: string;
  phone?: string | null;
  message?: string | null;
  createdAt: Date;
  updatedAt: Date;
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

export interface InquiryFormData {
  buildingId?: string;
  listingId?: string;
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
// SEARCH PARAM TYPES
// ============================================

export interface BuildingSearchParams {
  page?: number;
  limit?: number;
  kind?: BuildingKind | string;
  mohafazat?: string;
  caza?: string;
  city?: string;
  status?: PropertyStatus | string;
  visibility?: PropertyVisibility | string;
  featured?: boolean;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ListingSearchParams {
  page?: number;
  limit?: number;
  intent?: ListingIntent | string;
  status?: ListingStatus | string;
  unitKind?: UnitKind | string;
  buildingKind?: BuildingKind | string;
  mohafazat?: string;
  caza?: string;
  city?: string;
  minPrice?: number;
  maxPrice?: number;
  currency?: Currency | string;
  minBedrooms?: number;
  maxBedrooms?: number;
  minArea?: number;
  maxArea?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ============================================
// DASHBOARD / STATS TYPES
// ============================================

export interface ManagementDashboard {
  openTickets: {
    total: number;
    byPriority: {
      EMERGENCY: number;
      HIGH: number;
      NORMAL: number;
      LOW: number;
    };
  };
  overdueRent: {
    count: number;
    totalAmount: number;
    currency: Currency;
  };
  vacantUnits: number;
  rentedUnits: number;
  billsAwaitingSettlement: number;
  activeTenancies: number;
}

export interface RentRollEntry {
  tenancyId: string;
  unitId: string;
  unitNumber?: string | null;
  unitKind: UnitKind;
  buildingTitle: string;
  tenantName: string;
  tenantPhone?: string | null;
  rentAmount: number;
  rentCurrency: Currency;
  rentPeriod: RentPeriod;
  status: TenancyStatus;
  startDate: Date | string;
  endDate?: Date | string | null;
  lastPaymentDate?: Date | string | null;
  nextDueDate?: Date | string | null;
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
    inquiries: PropertyInquiry[];
  };
  statistics: {
    usersByRole: { role: Role; _count: { role: number } }[];
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
