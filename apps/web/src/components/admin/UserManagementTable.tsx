'use client'

import { useState } from 'react'
import {
  Ban, CheckCircle, KeyRound, Loader2, MoreHorizontal, Pencil, Shield, Trash2, UserCheck, UserX,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ROLE_LABELS, type Role } from '@/lib/permissions'
import { banUser, deleteUser, unbanUser, type ManagedUser } from '@/lib/api/users'

/**
 * The user list — a table on a desktop, a stack of cards on a phone.
 *
 * A seven-column table inside `overflow-x-auto` is technically responsive and
 * practically unusable: on a 390px screen you see "User" and have to swipe
 * sideways, one column at a time, to find the button. Below `md` each row
 * becomes a card instead, with the same actions.
 */
export function UserManagementTable({
  users,
  currentUserId,
  onEdit,
  onSetPassword,
  onChanged,
}: {
  users: ManagedUser[]
  currentUserId: string
  onEdit: (user: ManagedUser) => void
  onSetPassword: (user: ManagedUser) => void
  onChanged: () => void
}) {
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function run(id: string, action: () => Promise<unknown>) {
    setBusyId(id)
    setError(null)
    try {
      await action()
      onChanged()
    } catch (err) {
      // The backend's refusal is the informative part ("this is the last active
      // super admin"); the old code replaced it with a generic alert().
      setError(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setBusyId(null)
    }
  }

  function handleBan(user: ManagedUser) {
    const reason = prompt(`Why is ${user.email} being banned?`)
    if (!reason) return
    run(user.id, () => banUser(user.id, reason))
  }

  function handleDelete(user: ManagedUser) {
    if (!confirm(`Delete ${user.email}? This cannot be undone.`)) return
    run(user.id, () => deleteUser(user.id))
  }

  return (
    <div>
      {error && (
        <p className="mx-4 mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 sm:mx-6">
          {error}
        </p>
      )}

      {/* Phone: cards */}
      <ul className="divide-y divide-slate-200 md:hidden">
        {users.map((user) => (
          <li key={user.id} className={`p-4 ${user.id === currentUserId ? 'bg-blue-50/60' : ''}`}>
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {displayName(user)}
                  {user.id === currentUserId && <span className="ml-1 text-xs font-normal text-blue-600">(you)</span>}
                </p>
                <p className="truncate text-sm text-slate-500">{user.email}</p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <RoleBadge role={user.role} />
                  <StatusBadge user={user} />
                </div>
                <p className="mt-2 text-xs text-slate-400">
                  Last login {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : 'never'}
                  {' · '}joined {new Date(user.createdAt).toLocaleDateString()}
                </p>
              </div>
              <Actions
                user={user}
                currentUserId={currentUserId}
                busy={busyId === user.id}
                onEdit={onEdit}
                onSetPassword={onSetPassword}
                onBan={handleBan}
                onUnban={(u) => run(u.id, () => unbanUser(u.id))}
                onDelete={handleDelete}
              />
            </div>
          </li>
        ))}
      </ul>

      {/* Desktop: table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <Th>User</Th>
              <Th>Role</Th>
              <Th>Status</Th>
              <Th>Activity</Th>
              <Th>Last login</Th>
              <Th>Joined</Th>
              <th className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {users.map((user) => (
              <tr key={user.id} className={user.id === currentUserId ? 'bg-blue-50/60' : ''}>
                <td className="px-6 py-4">
                  <div className="text-sm font-medium text-slate-900">{displayName(user)}</div>
                  <div className="text-sm text-slate-500">{user.email}</div>
                  {user.id === currentUserId && <span className="text-xs text-blue-600">(You)</span>}
                </td>
                <td className="whitespace-nowrap px-6 py-4"><RoleBadge role={user.role} /></td>
                <td className="whitespace-nowrap px-6 py-4"><StatusBadge user={user} /></td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-500">
                  <span className="block">{user._count?.propertyInquiries ?? 0} inquiries</span>
                  <span className="block">{user._count?.favoriteProperties ?? 0} favourites</span>
                  <span className="block">{user._count?.ownedProperties ?? 0} properties</span>
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-500">
                  {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : 'Never'}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-500">
                  {new Date(user.createdAt).toLocaleDateString()}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-right">
                  <Actions
                    user={user}
                    currentUserId={currentUserId}
                    busy={busyId === user.id}
                    onEdit={onEdit}
                    onSetPassword={onSetPassword}
                    onBan={handleBan}
                    onUnban={(u) => run(u.id, () => unbanUser(u.id))}
                    onDelete={handleDelete}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {users.length === 0 && (
        <p className="px-6 py-10 text-center text-sm text-slate-500">No users match this filter.</p>
      )}
    </div>
  )
}

function Actions({
  user, currentUserId, busy, onEdit, onSetPassword, onBan, onUnban, onDelete,
}: {
  user: ManagedUser
  currentUserId: string
  busy: boolean
  onEdit: (u: ManagedUser) => void
  onSetPassword: (u: ManagedUser) => void
  onBan: (u: ManagedUser) => void
  onUnban: (u: ManagedUser) => void
  onDelete: (u: ManagedUser) => void
}) {
  const isSelf = user.id === currentUserId

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={busy}
          aria-label={`Actions for ${user.email}`}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={() => onEdit(user)}>
          <Pencil className="mr-2 h-4 w-4" /> Edit details &amp; role
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onSetPassword(user)}>
          <KeyRound className="mr-2 h-4 w-4" /> Set password
        </DropdownMenuItem>

        {!isSelf && (
          <>
            <DropdownMenuSeparator />
            {user.bannedAt ? (
              <DropdownMenuItem onClick={() => onUnban(user)}>
                <CheckCircle className="mr-2 h-4 w-4 text-green-600" /> Unban user
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => onBan(user)}>
                <Ban className="mr-2 h-4 w-4 text-red-600" /> Ban user
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDelete(user)}
              className="text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              <Trash2 className="mr-2 h-4 w-4" /> Delete user
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
      {children}
    </th>
  )
}

const ROLE_STYLES: Record<Role, string> = {
  SUPER_ADMIN: 'bg-amber-100 text-amber-800',
  ADMIN: 'bg-blue-100 text-blue-800',
  CRM_MANAGER: 'bg-emerald-100 text-emerald-800',
  AGENT: 'bg-violet-100 text-violet-800',
  USER: 'bg-slate-100 text-slate-700',
}

function RoleBadge({ role }: { role: Role }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        ROLE_STYLES[role] ?? ROLE_STYLES.USER
      }`}
    >
      <Shield className="mr-1 h-3 w-3" />
      {ROLE_LABELS[role] ?? role}
    </span>
  )
}

function StatusBadge({ user }: { user: ManagedUser }) {
  if (user.bannedAt) {
    return (
      <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
        <Ban className="mr-1 h-3 w-3" /> Banned
      </span>
    )
  }
  if (!user.isActive) {
    return (
      <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800">
        <UserX className="mr-1 h-3 w-3" /> Inactive
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
      <UserCheck className="mr-1 h-3 w-3" /> Active
    </span>
  )
}

function displayName(user: ManagedUser): string {
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim()
  return name || '—'
}
