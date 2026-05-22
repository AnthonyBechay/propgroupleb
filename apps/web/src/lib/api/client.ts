// API Client for PropGroup Backend
// For production, NEXT_PUBLIC_API_URL must be set in Vercel environment variables
import { normalizeApiUrl } from '../utils/api-url';
import type {
  ApiResponse,
  PaginatedResponse,
  Building,
  Unit,
  UnitOption,
  Listing,
  Tenancy,
  RentPayment,
  MaintenanceTicket,
  TicketUpdate,
  Vendor,
  UtilityMeter,
  UtilityReading,
  UtilityBill,
  ServiceCharge,
  ManagementDashboard,
  RentRollEntry,
  FxRate,
  BuildingSearchParams,
  ListingSearchParams,
} from '@/types';

const API_BASE_URL = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL);

class ApiClient {
  private baseURL: string;

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = normalizeApiUrl(baseURL);
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    // Endpoints already include /api/ prefix, so just use as-is
    // Ensure endpoint starts with /
    const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${this.baseURL}${normalizedEndpoint}`;
    
    const config: RequestInit = {
      credentials: 'include', // Include cookies for authentication
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      const text = await response.text();

      if (!response.ok) {
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorData = JSON.parse(text);
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch {}

        // Log detailed error for debugging
        if (response.status === 401) {
          console.error(`[API] Unauthorized request to ${endpoint}`);
        } else if (response.status >= 500) {
          console.error(`[API] Server error on ${endpoint}:`, errorMessage);
        }

        throw new Error(errorMessage);
      }

      return JSON.parse(text);
    } catch (error: any) {
      // Enhanced error logging
      if (error.message?.includes('fetch')) {
        console.error(`[API] Network error for ${endpoint}:`, error.message);
      } else if (!error.message) {
        console.error(`[API] Unknown error for ${endpoint}:`, error);
      }
      throw error;
    }
  }

  // Auth endpoints
  async register(data: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    country?: string;
    investmentGoals?: string[];
  }) {
    return this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async login(email: string, password: string) {
    return this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async logout() {
    return this.request('/api/auth/logout', {
      method: 'POST',
    });
  }

  async getCurrentUser() {
    return this.request('/api/auth/me');
  }

  async updateProfile(data: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    country?: string;
    investmentGoals?: string[];
  }) {
    return this.request('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async changePassword(data: {
    currentPassword: string;
    newPassword: string;
  }) {
    return this.request('/api/auth/change-password', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Properties endpoints
  async getProperties(params?: {
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
  }) {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, value.toString());
        }
      });
    }

    const queryString = searchParams.toString();
    return this.request(`/api/properties${queryString ? `?${queryString}` : ''}`);
  }

  async getProperty(id: string) {
    return this.request(`/api/properties/${id}`);
  }

  async createProperty(data: any) {
    return this.request('/api/properties', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateProperty(id: string, data: any) {
    return this.request(`/api/properties/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteProperty(id: string) {
    return this.request(`/api/properties/${id}`, {
      method: 'DELETE',
    });
  }

  // Favorites endpoints
  async getFavorites() {
    return this.request('/api/favorites');
  }

  async addFavorite(propertyId: string) {
    return this.request(`/api/favorites/${propertyId}`, {
      method: 'POST',
    });
  }

  async removeFavorite(propertyId: string) {
    return this.request(`/api/favorites/${propertyId}`, {
      method: 'DELETE',
    });
  }

  async checkFavorite(propertyId: string) {
    return this.request(`/api/favorites/check/${propertyId}`);
  }

  // Inquiries endpoints
  async createInquiry(data: {
    propertyId: string;
    name: string;
    email: string;
    phone?: string;
    message?: string;
  }) {
    return this.request('/api/inquiries', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getMyInquiries() {
    return this.request('/api/inquiries/my');
  }

  async getInquiries(params?: {
    page?: number;
    limit?: number;
    propertyId?: string;
  }) {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, value.toString());
        }
      });
    }
    
    const queryString = searchParams.toString();
    return this.request(`/api/inquiries${queryString ? `?${queryString}` : ''}`);
  }

  async getInquiry(id: string) {
    return this.request(`/api/inquiries/${id}`);
  }

  async deleteInquiry(id: string) {
    return this.request(`/api/inquiries/${id}`, {
      method: 'DELETE',
    });
  }

  // Portfolio endpoints
  async getPortfolio() {
    return this.request('/api/portfolio');
  }

  async addToPortfolio(data: {
    customName: string;
    purchasePrice: number;
    purchaseDate: string;
    initialMortgage?: number;
    currentRent?: number;
    notes?: string;
    propertyId?: string;
  }) {
    return this.request('/api/portfolio', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updatePortfolioItem(id: string, data: any) {
    return this.request(`/api/portfolio/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async removeFromPortfolio(id: string) {
    return this.request(`/api/portfolio/${id}`, {
      method: 'DELETE',
    });
  }

  async getPortfolioStats() {
    return this.request('/api/portfolio/stats');
  }

  // Users endpoints (admin)
  async getUsers(params?: {
    page?: number;
    limit?: number;
    role?: string;
    search?: string;
    isActive?: boolean;
  }) {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, value.toString());
        }
      });
    }
    
    const queryString = searchParams.toString();
    return this.request(`/api/users${queryString ? `?${queryString}` : ''}`);
  }

  async getUser(id: string) {
    return this.request(`/api/users/${id}`);
  }

  async updateUserRole(id: string, role: string) {
    return this.request(`/api/users/${id}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    });
  }

  async banUser(id: string, reason: string) {
    return this.request(`/api/users/${id}/ban`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  async unbanUser(id: string) {
    return this.request(`/api/users/${id}/unban`, {
      method: 'POST',
    });
  }

  async deleteUser(id: string) {
    return this.request(`/api/users/${id}`, {
      method: 'DELETE',
    });
  }

  async inviteAdmin(email: string, role: string) {
    return this.request('/api/users/invite', {
      method: 'POST',
      body: JSON.stringify({ email, role }),
    });
  }

  // Admin endpoints
  async getAdminStats() {
    return this.request('/api/admin/stats');
  }

  async getAuditLogs(params?: {
    page?: number;
    limit?: number;
    action?: string;
    adminId?: string;
  }) {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, value.toString());
        }
      });
    }
    
    const queryString = searchParams.toString();
    return this.request(`/api/admin/audit-logs${queryString ? `?${queryString}` : ''}`);
  }

  async createSuperAdmin(email: string, password: string) {
    return this.request('/api/admin/create-super-admin', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async getSystemHealth() {
    return this.request('/api/admin/health');
  }

  // AI Search endpoints
  async aiSearch(query: string, context?: { userId?: string; previousSearches?: string[] }) {
    return this.request('/api/ai-search', {
      method: 'POST',
      body: JSON.stringify({ query, context }),
    });
  }

  async getAISearchSuggestions() {
    return this.request('/api/ai-search/suggestions');
  }

  // Agent endpoints
  async getAgentDashboardStats() {
    return this.request('/api/agent/dashboard/stats');
  }

  async getAgentProperties(params?: {
    page?: number;
    limit?: number;
    status?: string;
    availabilityStatus?: string;
    search?: string;
  }) {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, value.toString());
        }
      });
    }

    const queryString = searchParams.toString();
    return this.request(`/api/agent/properties${queryString ? `?${queryString}` : ''}`);
  }

  async getAgentInquiries(params?: {
    page?: number;
    limit?: number;
    propertyId?: string;
  }) {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, value.toString());
        }
      });
    }

    const queryString = searchParams.toString();
    return this.request(`/api/agent/inquiries${queryString ? `?${queryString}` : ''}`);
  }

  async getAgentProfile() {
    return this.request('/api/agent/profile');
  }

  async updateAgentProfile(data: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    agentLicenseNumber?: string;
    agentCompany?: string;
    agentBio?: string;
    agentCommissionRate?: number;
  }) {
    return this.request('/api/agent/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async updatePropertyStatus(propertyId: string, availabilityStatus: string) {
    return this.request(`/api/agent/properties/${propertyId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ availabilityStatus }),
    });
  }

  async getAgentAnalytics(period?: number) {
    const searchParams = new URLSearchParams();
    if (period) {
      searchParams.append('period', period.toString());
    }
    const queryString = searchParams.toString();
    return this.request(`/api/agent/analytics${queryString ? `?${queryString}` : ''}`);
  }
  // Content (CMS) endpoints
  async getContentBySection(section: string) {
    return this.request(`/api/content?section=${encodeURIComponent(section)}`);
  }

  async getAllContent() {
    return this.request('/api/content/all');
  }

  async updateContent(key: string, data: { section?: string; title?: string; content?: string; metadata?: Record<string, unknown>; sortOrder?: number; isActive?: boolean }) {
    return this.request(`/api/content/${encodeURIComponent(key)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteContent(key: string) {
    return this.request(`/api/content/${encodeURIComponent(key)}`, {
      method: 'DELETE',
    });
  }

  async updateMedia(key: string, data: { section?: string; url: string; alt?: string; caption?: string }) {
    return this.request(`/api/content/media/${encodeURIComponent(key)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteMedia(key: string) {
    return this.request(`/api/content/media/${encodeURIComponent(key)}`, {
      method: 'DELETE',
    });
  }

  // ============================================
  // BUILDINGS
  // ============================================

  private buildQueryString(params?: Record<string, any>): string {
    if (!params) return '';
    const sp = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        sp.append(key, value.toString());
      }
    });
    const qs = sp.toString();
    return qs ? `?${qs}` : '';
  }

  async getBuildings(params?: BuildingSearchParams): Promise<PaginatedResponse<Building>> {
    return this.request(`/api/buildings${this.buildQueryString(params)}`);
  }

  async getBuildingBySlug(slug: string): Promise<ApiResponse<Building>> {
    return this.request(`/api/buildings/slug/${encodeURIComponent(slug)}`);
  }

  async getBuilding(id: string): Promise<ApiResponse<Building>> {
    return this.request(`/api/buildings/${id}`);
  }

  async createBuilding(data: Partial<Building>): Promise<ApiResponse<Building>> {
    return this.request('/api/buildings', { method: 'POST', body: JSON.stringify(data) });
  }

  async updateBuilding(id: string, data: Partial<Building>): Promise<ApiResponse<Building>> {
    return this.request(`/api/buildings/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }

  async deleteBuilding(id: string): Promise<ApiResponse<null>> {
    return this.request(`/api/buildings/${id}`, { method: 'DELETE' });
  }

  async getBuildingUnits(buildingId: string): Promise<ApiResponse<Unit[]>> {
    return this.request(`/api/buildings/${buildingId}/units`);
  }

  async createUnit(buildingId: string, data: Partial<Unit>): Promise<ApiResponse<Unit>> {
    return this.request(`/api/buildings/${buildingId}/units`, { method: 'POST', body: JSON.stringify(data) });
  }

  // ============================================
  // UNITS
  // ============================================

  async getUnits(params?: Record<string, string>): Promise<PaginatedResponse<Unit>> {
    return this.request(`/api/units${this.buildQueryString(params)}`);
  }

  async getUnit(id: string): Promise<ApiResponse<Unit>> {
    return this.request(`/api/units/${id}`);
  }

  async updateUnit(id: string, data: Partial<Unit>): Promise<ApiResponse<Unit>> {
    return this.request(`/api/units/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }

  async deleteUnit(id: string): Promise<ApiResponse<null>> {
    return this.request(`/api/units/${id}`, { method: 'DELETE' });
  }

  async createUnitOption(unitId: string, data: Partial<UnitOption>): Promise<ApiResponse<UnitOption>> {
    return this.request(`/api/units/${unitId}/options`, { method: 'POST', body: JSON.stringify(data) });
  }

  async updateUnitOption(unitId: string, optionId: string, data: Partial<UnitOption>): Promise<ApiResponse<UnitOption>> {
    return this.request(`/api/units/${unitId}/options/${optionId}`, { method: 'PUT', body: JSON.stringify(data) });
  }

  async deleteUnitOption(unitId: string, optionId: string): Promise<ApiResponse<null>> {
    return this.request(`/api/units/${unitId}/options/${optionId}`, { method: 'DELETE' });
  }

  // ============================================
  // LISTINGS
  // ============================================

  async getListings(params?: ListingSearchParams): Promise<PaginatedResponse<Listing>> {
    return this.request(`/api/listings${this.buildQueryString(params)}`);
  }

  async getListingBySlug(slug: string): Promise<ApiResponse<Listing>> {
    return this.request(`/api/listings/slug/${encodeURIComponent(slug)}`);
  }

  async getListing(id: string): Promise<ApiResponse<Listing>> {
    return this.request(`/api/listings/${id}`);
  }

  async createListing(data: Partial<Listing>): Promise<ApiResponse<Listing>> {
    return this.request('/api/listings', { method: 'POST', body: JSON.stringify(data) });
  }

  async updateListing(id: string, data: Partial<Listing>): Promise<ApiResponse<Listing>> {
    return this.request(`/api/listings/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }

  async deleteListing(id: string): Promise<ApiResponse<null>> {
    return this.request(`/api/listings/${id}`, { method: 'DELETE' });
  }

  // ============================================
  // TENANCIES
  // ============================================

  async getTenancies(params?: Record<string, string>): Promise<PaginatedResponse<Tenancy>> {
    return this.request(`/api/tenancies${this.buildQueryString(params)}`);
  }

  async getTenancy(id: string): Promise<ApiResponse<Tenancy>> {
    return this.request(`/api/tenancies/${id}`);
  }

  async createTenancy(data: Partial<Tenancy>): Promise<ApiResponse<Tenancy>> {
    return this.request('/api/tenancies', { method: 'POST', body: JSON.stringify(data) });
  }

  async updateTenancy(id: string, data: Partial<Tenancy>): Promise<ApiResponse<Tenancy>> {
    return this.request(`/api/tenancies/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }

  async endTenancy(id: string, notes?: string): Promise<ApiResponse<Tenancy>> {
    return this.request(`/api/tenancies/${id}/end`, { method: 'POST', body: JSON.stringify({ notes }) });
  }

  async getTenancyPayments(id: string): Promise<ApiResponse<RentPayment[]>> {
    return this.request(`/api/tenancies/${id}/payments`);
  }

  async createRentPayment(tenancyId: string, data: Partial<RentPayment>): Promise<ApiResponse<RentPayment>> {
    return this.request(`/api/tenancies/${tenancyId}/payments`, { method: 'POST', body: JSON.stringify(data) });
  }

  async updateRentPayment(tenancyId: string, paymentId: string, data: Partial<RentPayment>): Promise<ApiResponse<RentPayment>> {
    return this.request(`/api/tenancies/${tenancyId}/payments/${paymentId}`, { method: 'PUT', body: JSON.stringify(data) });
  }

  // ============================================
  // TICKETS
  // ============================================

  async getTickets(params?: Record<string, string>): Promise<PaginatedResponse<MaintenanceTicket>> {
    return this.request(`/api/tickets${this.buildQueryString(params)}`);
  }

  async getTicket(id: string): Promise<ApiResponse<MaintenanceTicket>> {
    return this.request(`/api/tickets/${id}`);
  }

  async createTicket(data: Partial<MaintenanceTicket>): Promise<ApiResponse<MaintenanceTicket>> {
    return this.request('/api/tickets', { method: 'POST', body: JSON.stringify(data) });
  }

  async updateTicket(id: string, data: Partial<MaintenanceTicket>): Promise<ApiResponse<MaintenanceTicket>> {
    return this.request(`/api/tickets/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }

  async addTicketUpdate(id: string, body: string, statusTo?: string): Promise<ApiResponse<TicketUpdate>> {
    return this.request(`/api/tickets/${id}/updates`, { method: 'POST', body: JSON.stringify({ body, statusTo }) });
  }

  // ============================================
  // VENDORS
  // ============================================

  async getVendors(params?: Record<string, string>): Promise<PaginatedResponse<Vendor>> {
    return this.request(`/api/vendors${this.buildQueryString(params)}`);
  }

  async createVendor(data: Partial<Vendor>): Promise<ApiResponse<Vendor>> {
    return this.request('/api/vendors', { method: 'POST', body: JSON.stringify(data) });
  }

  async updateVendor(id: string, data: Partial<Vendor>): Promise<ApiResponse<Vendor>> {
    return this.request(`/api/vendors/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }

  async deleteVendor(id: string): Promise<ApiResponse<null>> {
    return this.request(`/api/vendors/${id}`, { method: 'DELETE' });
  }

  // ============================================
  // UTILITIES
  // ============================================

  async getMeters(params?: Record<string, string>): Promise<ApiResponse<UtilityMeter[]>> {
    return this.request(`/api/utilities/meters${this.buildQueryString(params)}`);
  }

  async createMeter(data: Partial<UtilityMeter>): Promise<ApiResponse<UtilityMeter>> {
    return this.request('/api/utilities/meters', { method: 'POST', body: JSON.stringify(data) });
  }

  async addMeterReading(meterId: string, data: { readingAt: string; value: number; photoKey?: string }): Promise<ApiResponse<UtilityReading>> {
    return this.request(`/api/utilities/meters/${meterId}/readings`, { method: 'POST', body: JSON.stringify(data) });
  }

  async getBills(params?: Record<string, string>): Promise<PaginatedResponse<UtilityBill>> {
    return this.request(`/api/utilities/bills${this.buildQueryString(params)}`);
  }

  async getBill(id: string): Promise<ApiResponse<UtilityBill>> {
    return this.request(`/api/utilities/bills/${id}`);
  }

  async createBill(data: Partial<UtilityBill>): Promise<ApiResponse<UtilityBill>> {
    return this.request('/api/utilities/bills', { method: 'POST', body: JSON.stringify(data) });
  }

  async allocateBill(id: string, method: string, unitShares?: Array<{ unitId: string; share: number }>): Promise<ApiResponse<UtilityBill>> {
    return this.request(`/api/utilities/bills/${id}/allocate`, { method: 'POST', body: JSON.stringify({ method, unitShares }) });
  }

  // ============================================
  // SERVICE CHARGES
  // ============================================

  async getServiceCharges(params?: Record<string, string>): Promise<ApiResponse<ServiceCharge[]>> {
    return this.request(`/api/service-charges${this.buildQueryString(params)}`);
  }

  async createServiceCharge(data: Partial<ServiceCharge>): Promise<ApiResponse<ServiceCharge>> {
    return this.request('/api/service-charges', { method: 'POST', body: JSON.stringify(data) });
  }

  async updateServiceCharge(id: string, data: Partial<ServiceCharge>): Promise<ApiResponse<ServiceCharge>> {
    return this.request(`/api/service-charges/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }

  async generateServiceChargeShares(id: string, dueDate: string): Promise<ApiResponse<{ count: number }>> {
    return this.request(`/api/service-charges/${id}/generate`, { method: 'POST', body: JSON.stringify({ dueDate }) });
  }

  // ============================================
  // MANAGEMENT DASHBOARD
  // ============================================

  async getManagementDashboard(): Promise<ApiResponse<ManagementDashboard>> {
    return this.request('/api/management/dashboard');
  }

  async getRentRoll(params?: Record<string, string>): Promise<PaginatedResponse<RentRollEntry>> {
    return this.request(`/api/management/rent-roll${this.buildQueryString(params)}`);
  }

  async getOverdueRent(): Promise<ApiResponse<RentPayment[]>> {
    return this.request('/api/management/overdue-rent');
  }

  // ============================================
  // FX RATES
  // ============================================

  async getLatestFxRate(): Promise<ApiResponse<FxRate>> {
    return this.request('/api/fx-rates/latest');
  }

  async setFxRate(data: { date: string; usdToLbp: number; source?: string }): Promise<ApiResponse<FxRate>> {
    return this.request('/api/fx-rates', { method: 'POST', body: JSON.stringify(data) });
  }
}

// Export singleton instance
export const apiClient = new ApiClient();
export default apiClient;
