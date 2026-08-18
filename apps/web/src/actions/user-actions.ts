'use server'

import { apiClient } from '@/lib/api/client'
import { getCurrentUser, isSuperAdmin, logAdminAction } from '@/lib/auth/rbac'
import { revalidatePath } from 'next/cache'
import { UserRole } from '@/lib/auth/rbac'
import { ApiResponse, User } from '@/lib/types/api'

export async function updateUserRole(userId: string, newRole: UserRole) {
  const currentUser = await getCurrentUser()
  
  if (!currentUser || currentUser.role !== 'SUPER_ADMIN') {
    throw new Error('Unauthorized: Only super admins can update user roles')
  }
  
  if (currentUser.id === userId) {
    throw new Error('You cannot change your own role')
  }
  
  try {
    // Update the user's role using the API client
    const response = await apiClient.updateUserRole(userId, newRole) as ApiResponse<User>
    
    if (response.success) {
      revalidatePath('/admin/users/manage')
      return { success: true, user: response.data }
    } else {
      throw new Error(response.message || 'Failed to update user role')
    }
  } catch (error) {
    console.error('Error updating user role:', error)
    throw new Error('Failed to update user role')
  }
}

export async function banUser(userId: string, reason: string) {
  const currentUser = await getCurrentUser()
  
  if (!currentUser || (currentUser.role !== 'ADMIN' && currentUser.role !== 'SUPER_ADMIN')) {
    throw new Error('Unauthorized: Only admins can ban users')
  }
  
  if (currentUser.id === userId) {
    throw new Error('You cannot ban yourself')
  }
  
  try {
    // Ban the user using the API client
    const response = await apiClient.banUser(userId, reason) as ApiResponse<User>
    
    if (response.success) {
      revalidatePath('/admin/users')
      revalidatePath('/admin/users/manage')
      return { success: true, user: response.data }
    } else {
      throw new Error(response.message || 'Failed to ban user')
    }
  } catch (error) {
    console.error('Error banning user:', error)
    throw new Error('Failed to ban user')
  }
}

export async function unbanUser(userId: string) {
  const currentUser = await getCurrentUser()
  
  if (!currentUser || (currentUser.role !== 'ADMIN' && currentUser.role !== 'SUPER_ADMIN')) {
    throw new Error('Unauthorized: Only admins can unban users')
  }
  
  try {
    // Unban the user using the API client
    const response = await apiClient.unbanUser(userId) as ApiResponse<User>
    
    if (response.success) {
      revalidatePath('/admin/users')
      revalidatePath('/admin/users/manage')
      return { success: true, user: response.data }
    } else {
      throw new Error(response.message || 'Failed to unban user')
    }
  } catch (error) {
    console.error('Error unbanning user:', error)
    throw new Error('Failed to unban user')
  }
}

export async function deleteUser(userId: string) {
  const currentUser = await getCurrentUser()
  
  if (!currentUser || currentUser.role !== 'SUPER_ADMIN') {
    throw new Error('Unauthorized: Only super admins can delete users')
  }
  
  if (currentUser.id === userId) {
    throw new Error('You cannot delete yourself')
  }
  
  try {
    // Delete the user using the API client
    const response = await apiClient.deleteUser(userId) as ApiResponse
    
    if (response.success) {
      revalidatePath('/admin/users')
      revalidatePath('/admin/users/manage')
      return { success: true }
    } else {
      throw new Error(response.message || 'Failed to delete user')
    }
  } catch (error) {
    console.error('Error deleting user:', error)
    throw new Error('Failed to delete user')
  }
}

export async function inviteAdmin(email: string, role: 'CRM_MANAGER' | 'ADMIN' | 'SUPER_ADMIN') {
  const currentUser = await getCurrentUser()
  
  if (!currentUser || currentUser.role !== 'SUPER_ADMIN') {
    throw new Error('Unauthorized: Only super admins can invite other admins')
  }
  
  try {
    // Invite admin using the API client
    const response = await apiClient.inviteAdmin(email, role) as ApiResponse<User>
    
    if (response.success) {
      revalidatePath('/admin/users/manage')
      return { success: true, user: response.data }
    } else {
      throw new Error(response.message || 'Failed to invite admin')
    }
  } catch (error) {
    console.error('Error inviting admin:', error)
    throw new Error('Failed to invite admin')
  }
}
