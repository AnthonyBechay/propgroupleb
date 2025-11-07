// API Client for PropGroup Backend
// For production, NEXT_PUBLIC_API_URL must be set in Vercel environment variables
import { normalizeApiUrl } from '../utils/api-url';

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
    
    // Always log in production to debug issues
    console.log('[API Client] Request:', url, 'baseURL:', this.baseURL, 'endpoint:', normalizedEndpoint);

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

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.message || errorData.error || `HTTP error! status: ${response.status}`;

        // Log detailed error for debugging
        if (response.status === 401) {
          console.error(`[API] Unauthorized request to ${endpoint}`);
        } else if (response.status >= 500) {
          console.error(`[API] Server error on ${endpoint}:`, errorMessage);
        }

        throw new Error(errorMessage);
      }

      return await response.json();
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
}

// Export singleton instance
export const apiClient = new ApiClient();
export default apiClient;
