import { apiClient } from '@/lib/api/client'
import { ApiResponse, User } from '@/lib/types/api'

export interface AdminUser {
  id: string
  email: string
  role: 'USER' | 'ADMIN' | 'SUPER_ADMIN'
  isActive: boolean
  bannedAt?: string | null
  emailVerifiedAt?: string | null
  createdAt: string
  lastLoginAt?: string | null
}

/**
 * Get all users for admin management
 */
export async function getAllUsers(): Promise<AdminUser[]> {
  try {
    const response = await apiClient.getUsers() as ApiResponse<User[]>

    if (response.success && response.data) {
      return response.data.map((user: User): AdminUser => ({
        id: user.id,
        email: user.email || '',
        role: (user.role === 'AGENT' ? 'USER' : user.role) as 'USER' | 'ADMIN' | 'SUPER_ADMIN',
        isActive: user.isActive !== false,
        bannedAt: user.bannedAt || null,
        emailVerifiedAt: user.emailVerifiedAt || null,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt || null,
      }))
    }

    return []
  } catch (error) {
    console.error('Error fetching users:', error)
    return []
  }
}

/**
 * Update user role
 */
export async function updateUserRole(userId: string, role: 'USER' | 'ADMIN' | 'SUPER_ADMIN'): Promise<boolean> {
  try {
    const response = await apiClient.updateUserRole(userId, role) as ApiResponse
    return response.success === true
  } catch (error) {
    console.error('Error updating user role:', error)
    return false
  }
}

/**
 * Ban/unban user
 */
export async function toggleUserBan(userId: string, ban: boolean, reason?: string): Promise<boolean> {
  try {
    const response = ban
      ? await apiClient.banUser(userId, reason || 'No reason provided') as ApiResponse
      : await apiClient.unbanUser(userId) as ApiResponse

    return response.success === true
  } catch (error) {
    console.error('Error updating user ban status:', error)
    return false
  }
}

/**
 * Delete user
 */
export async function deleteUser(userId: string): Promise<boolean> {
  try {
    const response = await apiClient.deleteUser(userId) as ApiResponse
    return response.success === true
  } catch (error) {
    console.error('Error deleting user:', error)
    return false
  }
}

/**
 * Create admin user (invite)
 */
export async function inviteAdminUser(email: string, role: 'ADMIN' | 'SUPER_ADMIN'): Promise<boolean> {
  try {
    const response = await apiClient.inviteAdmin(email, role) as ApiResponse
    return response.success === true
  } catch (error) {
    console.error('Error inviting admin user:', error)
    return false
  }
}
