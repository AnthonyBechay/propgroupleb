'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { 
  MoreHorizontal, 
  Shield, 
  Ban, 
  CheckCircle, 
  UserX, 
  UserCheck,
  ShieldOff,
  ShieldCheck
} from 'lucide-react'
import { updateUserRole, banUser, unbanUser, deleteUser } from '@/actions/user-actions'
import { UserRole } from '@/lib/auth/rbac'

type User = {
  id: string
  email: string
  firstName?: string | null
  lastName?: string | null
  role: string
  isActive: boolean
  bannedAt?: Date | null
  bannedBy?: string | null
  bannedReason?: string | null
  emailVerifiedAt?: Date | null
  lastLoginAt?: Date | null
  createdAt: Date
  _count: {
    propertyInquiries: number
    favoriteProperties: number
    ownedProperties: number
  }
}

type UserManagementTableProps = {
  users: User[]
  currentUserId: string
}

export function UserManagementTable({ users, currentUserId }: UserManagementTableProps) {
  const [loading, setLoading] = useState<string | null>(null)

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    if (userId === currentUserId) {
      alert("You cannot change your own role")
      return
    }
    
    setLoading(userId)
    try {
      await updateUserRole(userId, newRole)
      window.location.reload()
    } catch (error) {
      console.error('Error updating role:', error)
      alert('Failed to update user role')
    }
    setLoading(null)
  }

  const handleBanUser = async (userId: string, reason?: string) => {
    if (userId === currentUserId) {
      alert("You cannot ban yourself")
      return
    }
    
    const banReason = reason || prompt("Enter ban reason:")
    if (!banReason) return
    
    setLoading(userId)
    try {
      await banUser(userId, banReason)
      window.location.reload()
    } catch (error) {
      console.error('Error banning user:', error)
      alert('Failed to ban user')
    }
    setLoading(null)
  }

  const handleUnbanUser = async (userId: string) => {
    setLoading(userId)
    try {
      await unbanUser(userId)
      window.location.reload()
    } catch (error) {
      console.error('Error unbanning user:', error)
      alert('Failed to unban user')
    }
    setLoading(null)
  }

  const handleDeleteUser = async (userId: string) => {
    if (userId === currentUserId) {
      alert("You cannot delete yourself")
      return
    }
    
    if (!confirm("Are you sure you want to delete this user? This action cannot be undone.")) {
      return
    }
    
    setLoading(userId)
    try {
      await deleteUser(userId)
      window.location.reload()
    } catch (error) {
      console.error('Error deleting user:', error)
      alert('Failed to delete user')
    }
    setLoading(null)
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return 'bg-purple-100 text-purple-800'
      case 'ADMIN':
        return 'bg-blue-100 text-blue-800'
      case 'CRM_MANAGER':
        return 'bg-emerald-100 text-emerald-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusBadge = (user: User) => {
    if (user.bannedAt) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
          <Ban className="h-3 w-3 mr-1" />
          Banned
        </span>
      )
    }
    if (!user.isActive) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
          <UserX className="h-3 w-3 mr-1" />
          Inactive
        </span>
      )
    }
    if (user.emailVerifiedAt) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <CheckCircle className="h-3 w-3 mr-1" />
          Verified
        </span>
      )
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
        Pending
      </span>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              User
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Role
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Activity
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Last Login
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Joined
            </th>
            <th className="relative px-6 py-3">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {users.map((user) => (
            <tr key={user.id} className={user.id === currentUserId ? 'bg-blue-50' : ''}>
              <td className="px-6 py-4 whitespace-nowrap">
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    {user.firstName} {user.lastName}
                  </div>
                  <div className="text-sm text-gray-500">{user.email}</div>
                  {user.id === currentUserId && (
                    <span className="text-xs text-blue-600">(You)</span>
                  )}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(user.role)}`}>
                  <Shield className="h-3 w-3 mr-1" />
                  {user.role}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                {getStatusBadge(user)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                <div className="flex flex-col space-y-1">
                  <span>{user._count.propertyInquiries} inquiries</span>
                  <span>{user._count.favoriteProperties} favorites</span>
                  <span>{user._count.ownedProperties} properties</span>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {user.lastLoginAt 
                  ? new Date(user.lastLoginAt).toLocaleDateString()
                  : 'Never'
                }
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {new Date(user.createdAt).toLocaleDateString()}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      disabled={loading === user.id}
                    >
                      <span className="sr-only">Open menu</span>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {/* Role Management */}
                    {user.id !== currentUserId && (
                      <>
                        <DropdownMenuItem
                          onClick={() => handleRoleChange(user.id, 'USER')}
                          disabled={user.role === 'USER'}
                        >
                          <UserCheck className="h-4 w-4 mr-2" />
                          Set as User
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleRoleChange(user.id, 'ADMIN')}
                          disabled={user.role === 'ADMIN'}
                        >
                          <ShieldCheck className="h-4 w-4 mr-2" />
                          Set as Admin
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleRoleChange(user.id, 'SUPER_ADMIN')}
                          disabled={user.role === 'SUPER_ADMIN'}
                        >
                          <Shield className="h-4 w-4 mr-2 text-purple-600" />
                          Set as Super Admin
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                      </>
                    )}
                    
                    {/* Ban/Unban Actions */}
                    {user.id !== currentUserId && (
                      <>
                        {user.bannedAt ? (
                          <DropdownMenuItem onClick={() => handleUnbanUser(user.id)}>
                            <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                            Unban User
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => handleBanUser(user.id)}>
                            <Ban className="h-4 w-4 mr-2 text-red-600" />
                            Ban User
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => handleDeleteUser(user.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <UserX className="h-4 w-4 mr-2" />
                          Delete User
                        </DropdownMenuItem>
                      </>
                    )}
                    
                    {user.id === currentUserId && (
                      <DropdownMenuItem disabled>
                        <span className="text-gray-400">No actions available for your own account</span>
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
