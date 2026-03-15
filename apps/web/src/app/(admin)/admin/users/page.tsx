'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useEffect, useState } from 'react'
import { UserManagementTable } from '@/components/admin/UserManagementTable'
import { InviteAdminModal } from '@/components/admin/InviteAdminModal'
import { Button } from '@/components/ui/button'
import { UserPlus, Shield, Activity, Loader2 } from 'lucide-react'

export default function SuperAdminUsersPage() {
  // Layout already handles authentication
  const { user } = useAuth()
  const [users, setUsers] = useState<any[]>([])
  const [recentActions, setRecentActions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch('/api/admin/users', {
          credentials: 'include'
        })

        if (response.ok) {
          const data = await response.json()
          setUsers(data.users)
          setRecentActions(data.recentActions)
        }
      } catch (error) {
        console.error('Error fetching users:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-purple-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading users...</p>
        </div>
      </div>
    )
  }

  const dummyUsers = users.length > 0 ? users : []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="h-6 w-6 text-purple-600" />
            User & Admin Management
          </h1>
          <p className="mt-2 text-sm text-gray-700">
            Manage all users, admins, and their permissions. Only super admins can access this page.
          </p>
        </div>
        <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
          <InviteAdminModal currentUserId={user?.id || ''}>
            <Button className="bg-purple-600 hover:bg-purple-700">
              <UserPlus className="h-4 w-4 mr-2" />
              Invite Admin
            </Button>
          </InviteAdminModal>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-600">Total Users</div>
          <div className="text-2xl font-bold">
            {dummyUsers.filter((u: any) => u.role === 'USER').length}
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-600">Admins</div>
          <div className="text-2xl font-bold text-blue-600">
            {dummyUsers.filter((u: any) => u.role === 'ADMIN').length}
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-600">Super Admins</div>
          <div className="text-2xl font-bold text-purple-600">
            {dummyUsers.filter((u: any) => u.role === 'SUPER_ADMIN').length}
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-600">Banned Users</div>
          <div className="text-2xl font-bold text-red-600">
            {dummyUsers.filter((u: any) => u.bannedAt).length}
          </div>
        </div>
      </div>

      {/* User Management Table */}
      <div className="bg-white shadow-sm rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">All Users</h2>
        </div>
        <UserManagementTable
          users={dummyUsers}
          currentUserId={user?.id || ''}
        />
      </div>

      {/* Recent Admin Activity */}
      <div className="bg-white shadow-sm rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900 flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Recent Admin Activity
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Admin
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Action
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Target
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {recentActions.map((action: any) => (
                <tr key={action.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {action.admin.firstName} {action.admin.lastName || action.admin.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {action.action}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {action.targetType} {action.targetId && `(${action.targetId.slice(0, 8)}...)`}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(action.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
