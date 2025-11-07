'use client'

import { Users, Shield, Ban, Trash2, Mail } from 'lucide-react'

interface User {
  id: string
  email: string
  role: 'USER' | 'ADMIN' | 'SUPER_ADMIN'
  isActive: boolean
  bannedAt?: string | null
  lastLoginAt?: string | null
}

export function UsersManagementClient({ users }: { users: User[] }) {
  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-900">All Users</h2>
          <InviteUserButton />
        </div>
      </div>

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
                Last Login
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map((user) => (
              <UserRow key={user.id} user={user} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function UserRow({ user }: { user: User }) {
  const roleColors = {
    USER: 'bg-gray-100 text-gray-800',
    ADMIN: 'bg-blue-100 text-blue-800',
    SUPER_ADMIN: 'bg-purple-100 text-purple-800'
  }

  const statusColors = {
    active: 'bg-green-100 text-green-800',
    banned: 'bg-red-100 text-red-800',
    inactive: 'bg-yellow-100 text-yellow-800'
  }

  const getStatus = () => {
    if (user.bannedAt) return 'banned'
    if (!user.isActive) return 'inactive'
    return 'active'
  }

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center">
          <div className="flex-shrink-0 h-10 w-10">
            <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
              <Users className="h-5 w-5 text-gray-600" />
            </div>
          </div>
          <div className="ml-4">
            <div className="text-sm font-medium text-gray-900">{user.email}</div>
            <div className="text-sm text-gray-500">ID: {user.id.slice(0, 8)}...</div>
          </div>
        </div>
      </td>

      <td className="px-6 py-4 whitespace-nowrap">
        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${roleColors[user.role]}`}>
          {user.role}
        </span>
      </td>

      <td className="px-6 py-4 whitespace-nowrap">
        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statusColors[getStatus()]}`}>
          {getStatus()}
        </span>
      </td>

      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : 'Never'}
      </td>

      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
        <div className="flex space-x-2">
          <RoleSelectButton userId={user.id} currentRole={user.role} />
          <BanButton userId={user.id} isBanned={!!user.bannedAt} />
          <DeleteButton userId={user.id} email={user.email} />
        </div>
      </td>
    </tr>
  )
}

function RoleSelectButton({ userId, currentRole }: { userId: string, currentRole: string }) {
  const handleRoleChange = async (newRole: string) => {
    if (newRole === currentRole) return

    if (!confirm(`Are you sure you want to change this user's role to ${newRole}?`)) {
      return
    }

    try {
      const { normalizeApiUrl } = await import('@/lib/utils/api-url');
      const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '');
      const response = await fetch(`${apiUrl}/api/users/${userId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ role: newRole }),
      })

      if (response.ok) {
        window.location.reload()
      } else {
        const error = await response.json()
        alert(`Failed to update role: ${error.message}`)
      }
    } catch (error) {
      console.error('Error updating role:', error)
      alert('Failed to update role. Please try again.')
    }
  }

  return (
    <select
      value={currentRole}
      onChange={(e) => handleRoleChange(e.target.value)}
      className="text-xs px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <option value="USER">User</option>
      <option value="ADMIN">Admin</option>
      <option value="SUPER_ADMIN">Super Admin</option>
    </select>
  )
}

function BanButton({ userId, isBanned }: { userId: string, isBanned: boolean }) {
  const handleToggleBan = async () => {
    const action = isBanned ? 'unban' : 'ban'
    const reason = !isBanned ? prompt('Please provide a reason for banning this user:') : null

    if (!isBanned && !reason) {
      return // User cancelled or didn't provide a reason
    }

    if (!confirm(`Are you sure you want to ${action} this user?`)) {
      return
    }

    try {
      const { normalizeApiUrl } = await import('@/lib/utils/api-url');
      const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '');
      const endpoint = isBanned
        ? `${apiUrl}/api/users/${userId}/unban`
        : `${apiUrl}/api/users/${userId}/ban`

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: !isBanned ? JSON.stringify({ reason }) : undefined,
      })

      if (response.ok) {
        window.location.reload()
      } else {
        const error = await response.json()
        alert(`Failed to ${action} user: ${error.message}`)
      }
    } catch (error) {
      console.error(`Error ${action}ning user:`, error)
      alert(`Failed to ${action} user. Please try again.`)
    }
  }

  return (
    <button
      onClick={handleToggleBan}
      className={`text-xs px-2 py-1 rounded flex items-center space-x-1 ${
        isBanned
          ? 'bg-green-100 text-green-800 hover:bg-green-200'
          : 'bg-red-100 text-red-800 hover:bg-red-200'
      }`}
    >
      {isBanned ? <Shield className="h-3 w-3" /> : <Ban className="h-3 w-3" />}
      <span>{isBanned ? 'Unban' : 'Ban'}</span>
    </button>
  )
}

function DeleteButton({ userId, email }: { userId: string, email: string }) {
  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete user ${email}? This action cannot be undone.`)) {
      return
    }

    try {
      const { normalizeApiUrl } = await import('@/lib/utils/api-url');
      const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '');
      const response = await fetch(`${apiUrl}/api/users/${userId}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (response.ok) {
        window.location.reload()
      } else {
        const error = await response.json()
        alert(`Failed to delete user: ${error.message}`)
      }
    } catch (error) {
      console.error('Error deleting user:', error)
      alert('Failed to delete user. Please try again.')
    }
  }

  return (
    <button
      onClick={handleDelete}
      className="text-xs px-2 py-1 bg-red-100 text-red-800 rounded hover:bg-red-200 flex items-center space-x-1"
    >
      <Trash2 className="h-3 w-3" />
      <span>Delete</span>
    </button>
  )
}

function InviteUserButton() {
  const handleInvite = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const email = formData.get('email') as string
    const role = formData.get('role') as string

    try {
      const { normalizeApiUrl } = await import('@/lib/utils/api-url');
      const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '');
      const response = await fetch(`${apiUrl}/api/users/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ email, role }),
      })

      if (response.ok) {
        alert(`Admin invitation sent to ${email}`)
        window.location.reload()
      } else {
        const error = await response.json()
        alert(`Failed to invite admin: ${error.message}`)
      }
    } catch (error) {
      console.error('Error inviting admin:', error)
      alert('Failed to invite admin. Please try again.')
    }
  }

  return (
    <form onSubmit={handleInvite} className="flex space-x-2">
      <input
        type="email"
        name="email"
        placeholder="admin@example.com"
        required
        className="text-sm px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <select
        name="role"
        className="text-sm px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="ADMIN">Admin</option>
        <option value="SUPER_ADMIN">Super Admin</option>
      </select>
      <button
        type="submit"
        className="text-sm px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center space-x-1"
      >
        <Mail className="h-4 w-4" />
        <span>Invite</span>
      </button>
    </form>
  )
}
