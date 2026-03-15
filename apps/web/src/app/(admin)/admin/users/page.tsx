'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useEffect, useState } from 'react'
import { UserManagementTable } from '@/components/admin/UserManagementTable'
import { InviteAdminModal } from '@/components/admin/InviteAdminModal'
import { Button } from '@/components/ui/button'
import { UserPlus, Shield, Activity, Loader2 } from 'lucide-react'
import { normalizeApiUrl } from '@/lib/utils/api-url'

const API_BASE_URL = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL)

export default function SuperAdminUsersPage() {
  const { user } = useAuth()
  const [users, setUsers] = useState<any[]>([])
  const [recentActions, setRecentActions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        // Call backend directly so auth cookies are sent to the correct domain
        const [usersRes, actionsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/users?limit=100`, {
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
          }),
          fetch(`${API_BASE_URL}/api/admin/audit-logs?limit=10`, {
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
          }),
        ])

        if (usersRes.ok) {
          const usersData = await usersRes.json()
          setUsers(usersData.data || [])
        } else {
          const errData = await usersRes.json().catch(() => ({}))
          setError(errData.message || errData.error || `Failed to load users (${usersRes.status})`)
        }

        if (actionsRes.ok) {
          const actionsData = await actionsRes.json()
          setRecentActions(actionsData.data || [])
        }
      } catch (err: any) {
        console.error('Error fetching users:', err)
        setError(err.message || 'Network error')
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
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading users...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center max-w-md">
          <Shield className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Failed to load users</h3>
          <p className="text-gray-500 text-sm mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

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
            Manage all users, admins, and their permissions.
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
            {users.filter((u: any) => u.role === 'USER').length}
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-600">Admins</div>
          <div className="text-2xl font-bold text-blue-600">
            {users.filter((u: any) => u.role === 'ADMIN').length}
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-600">Super Admins</div>
          <div className="text-2xl font-bold text-purple-600">
            {users.filter((u: any) => u.role === 'SUPER_ADMIN').length}
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-600">Banned Users</div>
          <div className="text-2xl font-bold text-red-600">
            {users.filter((u: any) => u.bannedAt).length}
          </div>
        </div>
      </div>

      {/* User Management Table */}
      <div className="bg-white shadow-sm rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">All Users</h2>
        </div>
        <UserManagementTable
          users={users}
          currentUserId={user?.id || ''}
        />
      </div>

      {/* Recent Admin Activity */}
      {recentActions.length > 0 && (
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
                      {action.admin?.firstName} {action.admin?.lastName || action.admin?.email}
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
      )}
    </div>
  )
}
