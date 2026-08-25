import { normalizeApiUrl } from '@/lib/utils/api-url'
import type { Role } from '@/lib/permissions'

/**
 * User administration, called straight from the browser.
 *
 * These used to be Next server actions that forwarded to `apiClient`. That
 * could never work: `apiClient` authenticates with `credentials: 'include'`,
 * which is a browser-only instruction — running inside a server action the
 * fetch carried no cookie at all, so every role change, ban and delete reached
 * the backend unauthenticated and came back 401. Talking to the API directly
 * from the client is both simpler and what the rest of the admin already does.
 */

const API = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')

export interface ManagedUser {
  id: string
  email: string
  firstName?: string | null
  lastName?: string | null
  phone?: string | null
  country?: string | null
  role: Role
  isActive: boolean
  bannedAt?: string | null
  bannedReason?: string | null
  emailVerifiedAt?: string | null
  lastLoginAt?: string | null
  createdAt: string
  _count?: {
    propertyInquiries?: number
    favoriteProperties?: number
    ownedProperties?: number
    managedBuildings?: number
  }
}

export interface CreateUserInput {
  email: string
  password: string
  role: Role
  firstName?: string
  lastName?: string
  phone?: string
  country?: string
  isActive?: boolean
}

export interface UpdateUserInput {
  firstName?: string
  lastName?: string
  phone?: string
  country?: string
  role?: Role
  isActive?: boolean
}

/**
 * One place that turns a failed response into a message worth showing.
 *
 * The backend's refusals are the useful part here — "this is the last active
 * super admin", "a user with this email already exists" — and the old code
 * threw a generic "Failed to update user role" over the top of every one.
 */
async function send<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}/api/users${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })

  const text = await res.text()
  let body: { data?: T; message?: string; error?: string } = {}
  try { body = text ? JSON.parse(text) : {} } catch { /* non-JSON error page */ }

  if (!res.ok) {
    throw new Error(body.message || body.error || `Request failed (${res.status})`)
  }
  return body.data as T
}

export function listUsers(limit = 200): Promise<ManagedUser[]> {
  return send<ManagedUser[]>(`?limit=${limit}`)
}

export function createUser(input: CreateUserInput): Promise<ManagedUser> {
  return send<ManagedUser>('', { method: 'POST', body: JSON.stringify(input) })
}

export function updateUser(id: string, input: UpdateUserInput): Promise<ManagedUser> {
  return send<ManagedUser>(`/${id}`, { method: 'PUT', body: JSON.stringify(input) })
}

export function setUserPassword(id: string, password: string): Promise<{ id: string }> {
  return send<{ id: string }>(`/${id}/password`, { method: 'POST', body: JSON.stringify({ password }) })
}

export function updateUserRole(id: string, role: Role): Promise<ManagedUser> {
  return send<ManagedUser>(`/${id}/role`, { method: 'PUT', body: JSON.stringify({ role }) })
}

export function banUser(id: string, reason: string): Promise<ManagedUser> {
  return send<ManagedUser>(`/${id}/ban`, { method: 'POST', body: JSON.stringify({ reason }) })
}

export function unbanUser(id: string): Promise<ManagedUser> {
  return send<ManagedUser>(`/${id}/unban`, { method: 'POST' })
}

export function deleteUser(id: string): Promise<null> {
  return send<null>(`/${id}`, { method: 'DELETE' })
}
