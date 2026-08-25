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
          // Session ended (expired/invalid token) — bounce to login and come
          // back to where they were. Skipped for the /me probe, which is how we
          // *check* whether someone is signed in.
          const code = (() => { try { return JSON.parse(text).code } catch { return undefined } })();
          if (
            typeof window !== 'undefined' &&
            (code === 'TOKEN_EXPIRED' || code === 'TOKEN_INVALID') &&
            !endpoint.includes('/auth/me') &&
            !window.location.pathname.startsWith('/auth/')
          ) {
            const next = encodeURIComponent(window.location.pathname + window.location.search);
            window.location.href = `/auth/login?next=${next}&expired=1`;
          }
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

  // User administration (create / edit / password / role / ban / delete) lives
  // in `lib/api/users.ts`, next to the screen that uses it and properly typed.
  // The duplicates that used to sit here were reachable only through the
  // deleted server actions, and `/api/users/invite` no longer exists.

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

  async archiveBuilding(id: string): Promise<ApiResponse<unknown>> {
    return this.request(`/api/buildings/${id}/archive`, { method: 'POST' });
  }

  async markBuildingSold(id: string): Promise<ApiResponse<unknown>> {
    return this.request(`/api/buildings/${id}/sold`, { method: 'POST' });
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

}

// Export singleton instance
export const apiClient = new ApiClient();
export default apiClient;
