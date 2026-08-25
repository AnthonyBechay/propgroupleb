'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Activity, Loader2, Search, Shield, UserPlus } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { UserManagementTable } from '@/components/admin/UserManagementTable'
import { UserFormModal } from '@/components/admin/UserFormModal'
import { listUsers, type ManagedUser } from '@/lib/api/users'
import { normalizeApiUrl } from '@/lib/utils/api-url'
import { ASSIGNABLE_ROLES, ROLE_LABELS, isSuperAdmin, type Role } from '@/lib/permissions'

const API = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL)

interface AuditEntry {
  id: string
  action: string
  targetType: string
  targetId?: string | null
  createdAt: string
  admin?: { firstName?: string | null; lastName?: string | null; email?: string | null }
}

type Dialog =
  | { mode: 'create' }
  | { mode: 'edit'; user: ManagedUser }
  | { mode: 'password'; user: ManagedUser }
  | null

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [audit, setAudit] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialog, setDialog] = useState<Dialog>(null)
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | Role>('all')

  const canManage = isSuperAdmin(currentUser?.role)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [people, logs] = await Promise.all([
        listUsers(200),
        // The audit list is a nice-to-have; a failure here must not blank the
        // page the operator actually came for.
        fetch(`${API}/api/admin/audit-logs?limit=10`, { credentials: 'include', cache: 'no-store' })
          .then((r) => (r.ok ? r.json() : { data: [] }))
          .catch(() => ({ data: [] })),
      ])
      setUsers(people ?? [])
      setAudit(logs.data ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return users.filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false
      if (!needle) return true
      return [u.email, u.firstName, u.lastName].filter(Boolean).some((v) =>
        String(v).toLowerCase().includes(needle)
      )
    })
  }, [users, query, roleFilter])

  const counts = useMemo(() => ({
    total: users.length,
    staff: users.filter((u) => u.role === 'ADMIN' || u.role === 'SUPER_ADMIN').length,
    crm: users.filter((u) => u.role === 'CRM_MANAGER').length,
    banned: users.filter((u) => u.bannedAt).length,
  }), [users])

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-zinc-700" />
          <p className="text-slate-500">Loading users…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-[400px] items-center justify-center px-4">
        <div className="max-w-md text-center">
          <Shield className="mx-auto mb-4 h-12 w-12 text-red-400" />
          <h2 className="mb-2 text-lg font-semibold text-slate-900">Couldn&apos;t load users</h2>
          <p className="mb-4 text-sm text-slate-500">{error}</p>
          <button
            onClick={load}
            className="min-h-11 rounded-lg bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900 sm:text-2xl">
            <Shield className="h-6 w-6 shrink-0 text-zinc-700" />
            Users &amp; access
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Create accounts, set passwords, and decide what each person can reach.
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => setDialog({ mode: 'create' })}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800 sm:flex-none"
          >
            <UserPlus className="h-4 w-4" />
            Create user
          </button>
        )}
      </div>

      {!canManage && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          You can view accounts here, but only a super admin can create users or change roles.
        </p>
      )}

      {/* 2-up on a phone rather than a single stacked column — four one-number
          tiles at full width push everything else below the fold. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total users" value={counts.total} />
        <Stat label="Admins" value={counts.staff} tone="text-blue-600" />
        <Stat label="CRM managers" value={counts.crm} tone="text-emerald-600" />
        <Stat label="Banned" value={counts.banned} tone="text-red-600" />
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or email"
            /* text-base below sm: anything smaller makes iOS Safari zoom the
               page on focus and never zoom back out. */
            className="min-h-11 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 sm:text-sm"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as 'all' | Role)}
          className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 sm:text-sm"
        >
          <option value="all">All roles</option>
          {ASSIGNABLE_ROLES.map((r) => (
            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-3 sm:px-6">
          <h2 className="text-base font-medium text-slate-900">
            {visible.length} {visible.length === 1 ? 'person' : 'people'}
          </h2>
        </div>
        <UserManagementTable
          users={visible}
          currentUserId={currentUser?.id ?? ''}
          onEdit={(u) => setDialog({ mode: 'edit', user: u })}
          onSetPassword={(u) => setDialog({ mode: 'password', user: u })}
          onChanged={load}
        />
      </div>

      {audit.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-3 sm:px-6">
            <h2 className="flex items-center gap-2 text-base font-medium text-slate-900">
              <Activity className="h-4 w-4" /> Recent admin activity
            </h2>
          </div>
          <ul className="divide-y divide-slate-100">
            {audit.map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 px-4 py-3 text-sm sm:px-6">
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                  {entry.action}
                </span>
                <span className="min-w-0 flex-1 truncate text-slate-600">
                  {entry.admin?.firstName || entry.admin?.email || 'Someone'} · {entry.targetType}
                </span>
                <span className="text-xs text-slate-400">
                  {new Date(entry.createdAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {dialog && (
        <UserFormModal
          mode={dialog.mode}
          user={dialog.mode === 'create' ? null : dialog.user}
          onClose={() => setDialog(null)}
          onSaved={load}
        />
      )}
    </div>
  )
}

function Stat({ label, value, tone = 'text-slate-900' }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs text-slate-500 sm:text-sm">{label}</div>
      <div className={`text-2xl font-bold ${tone}`}>{value}</div>
    </div>
  )
}
