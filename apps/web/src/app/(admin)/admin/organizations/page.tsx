'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Briefcase, Plus, Loader2, X, Users, Building2, Trash2, ChevronDown, ChevronUp, Mail, Wrench,
} from 'lucide-react'
import { normalizeApiUrl } from '@/lib/utils/api-url'

interface Org {
  id: string
  name: string
  slug: string
  type: 'AGENCY' | 'PM_COMPANY'
  isActive: boolean
  email?: string | null
  phone?: string | null
  _count?: { members: number; buildings: number }
}

interface Member {
  id: string
  role: 'OWNER' | 'ADMIN' | 'MANAGER' | 'TECHNICIAN'
  title?: string | null
  phone?: string | null
  isActive: boolean
  user: { id: string; email: string; firstName?: string | null; lastName?: string | null }
}

const ROLE_OPTIONS = ['OWNER', 'ADMIN', 'MANAGER', 'TECHNICIAN'] as const
const ROLE_COLORS: Record<string, string> = {
  OWNER: 'bg-violet-100 text-violet-700',
  ADMIN: 'bg-sky-100 text-sky-700',
  MANAGER: 'bg-emerald-100 text-emerald-700',
  TECHNICIAN: 'bg-amber-100 text-amber-700',
}

export default function OrganizationsPage() {
  const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
  const [orgs, setOrgs] = useState<Org[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  // create form
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: '', type: 'PM_COMPANY', ownerEmail: '', phone: '' })
  const [creating, setCreating] = useState(false)

  // expanded org members
  const [openId, setOpenId] = useState<string | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [memberForm, setMemberForm] = useState({ email: '', role: 'MANAGER', title: '', phone: '' })
  const [addingMember, setAddingMember] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${apiUrl}/api/organizations`, { credentials: 'include', cache: 'no-store' })
      if (res.ok) { const j = await res.json(); setOrgs(j.data ?? j) }
    } finally { setLoading(false) }
  }, [apiUrl])

  useEffect(() => { load() }, [load])

  async function createOrg() {
    if (!form.name.trim()) return
    setCreating(true)
    setMsg(null)
    try {
      const res = await fetch(`${apiUrl}/api/organizations`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          type: form.type,
          phone: form.phone || null,
          ownerEmail: form.ownerEmail.trim() || null,
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setMsg({ ok: false, text: j.message || 'Failed to create organization' }); return }
      setMsg({ ok: true, text: 'Organization created' })
      setForm({ name: '', type: 'PM_COMPANY', ownerEmail: '', phone: '' })
      setShowCreate(false)
      await load()
    } finally { setCreating(false) }
  }

  async function openOrg(id: string) {
    if (openId === id) { setOpenId(null); return }
    setOpenId(id)
    setMembersLoading(true)
    setMembers([])
    try {
      const res = await fetch(`${apiUrl}/api/organizations/${id}`, { credentials: 'include', cache: 'no-store' })
      if (res.ok) { const j = await res.json(); setMembers((j.data ?? j).members ?? []) }
    } finally { setMembersLoading(false) }
  }

  async function addMember(orgId: string) {
    if (!memberForm.email.trim()) return
    setAddingMember(true)
    setMsg(null)
    try {
      const res = await fetch(`${apiUrl}/api/organizations/${orgId}/members`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: memberForm.email.trim(),
          role: memberForm.role,
          title: memberForm.title || null,
          phone: memberForm.phone || null,
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setMsg({ ok: false, text: j.message || 'Failed to add member' }); return }
      setMemberForm({ email: '', role: 'MANAGER', title: '', phone: '' })
      await openRefresh(orgId)
      await load()
    } finally { setAddingMember(false) }
  }

  async function openRefresh(orgId: string) {
    const res = await fetch(`${apiUrl}/api/organizations/${orgId}`, { credentials: 'include', cache: 'no-store' })
    if (res.ok) { const j = await res.json(); setMembers((j.data ?? j).members ?? []) }
  }

  async function changeRole(orgId: string, memberId: string, role: string) {
    await fetch(`${apiUrl}/api/organizations/${orgId}/members/${memberId}`, {
      method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role }),
    })
    await openRefresh(orgId)
  }

  async function removeMember(orgId: string, memberId: string) {
    if (!confirm('Remove this member from the organization?')) return
    await fetch(`${apiUrl}/api/organizations/${orgId}/members/${memberId}`, { method: 'DELETE', credentials: 'include' })
    await openRefresh(orgId)
    await load()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center shadow-md">
              <Briefcase className="h-6 w-6 text-white" />
            </div>
            Organizations
          </h1>
          <p className="mt-2 text-slate-600">Create property-management companies and manage their teams & technicians.</p>
        </div>
        <button onClick={() => setShowCreate((s) => !s)} className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-800 text-white rounded-xl font-medium hover:bg-slate-700 transition-colors">
          <Plus className="w-4 h-4" /> New organization
        </button>
      </div>

      {msg && (
        <div className={`rounded-xl px-4 py-3 text-sm flex items-center justify-between gap-2 border ${msg.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
          {msg.text}
          <button onClick={() => setMsg(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      {showCreate && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
          <h2 className="font-semibold text-slate-900">New organization</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Company name *" className="px-3 py-2 border border-slate-200 rounded-lg text-sm" />
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white">
              <option value="PM_COMPANY">Property Management Company</option>
              <option value="AGENCY">Agency</option>
            </select>
            <input value={form.ownerEmail} onChange={(e) => setForm({ ...form, ownerEmail: e.target.value })} placeholder="Owner email (registered user)" className="px-3 py-2 border border-slate-200 rounded-lg text-sm" />
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone (optional)" className="px-3 py-2 border border-slate-200 rounded-lg text-sm" />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">Cancel</button>
            <button onClick={createOrg} disabled={creating || !form.name.trim()} className="px-5 py-2 text-sm font-medium text-white bg-slate-800 rounded-lg hover:bg-slate-700 disabled:opacity-50 flex items-center gap-2">
              {creating && <Loader2 className="w-4 h-4 animate-spin" />} Create
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400 gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Loading…</div>
      ) : orgs.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
          <Briefcase className="w-10 h-10 mx-auto mb-3 text-slate-200" />
          <p className="text-slate-500 font-medium">No organizations yet</p>
          <p className="text-slate-400 text-sm mt-1">Create a property-management company to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orgs.map((org) => (
            <div key={org.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <button onClick={() => openOrg(org.id)} className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-slate-50 transition-colors">
                <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center"><Briefcase className="w-4 h-4 text-slate-600" /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900">{org.name}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{org.type === 'PM_COMPANY' ? 'PM Company' : 'Agency'}</span>
                    {!org.isActive && <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600">Inactive</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400">
                    <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {org._count?.members ?? 0} members</span>
                    <span className="flex items-center gap-1"><Building2 className="w-3 h-3" /> {org._count?.buildings ?? 0} buildings</span>
                  </div>
                </div>
                {openId === org.id ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>

              {openId === org.id && (
                <div className="border-t border-slate-100 p-5 space-y-4 bg-slate-50/50">
                  {/* Add member */}
                  <div className="bg-white border border-slate-200 rounded-xl p-3">
                    <p className="text-xs font-semibold text-slate-600 mb-2">Add member / technician</p>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                      <input value={memberForm.email} onChange={(e) => setMemberForm({ ...memberForm, email: e.target.value })} placeholder="user@email.com" className="px-3 py-2 border border-slate-200 rounded-lg text-sm sm:col-span-2" />
                      <select value={memberForm.role} onChange={(e) => setMemberForm({ ...memberForm, role: e.target.value })} className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white">
                        {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r.charAt(0) + r.slice(1).toLowerCase()}</option>)}
                      </select>
                      <button onClick={() => addMember(org.id)} disabled={addingMember || !memberForm.email.trim()} className="px-3 py-2 text-sm font-medium text-white bg-sky-600 rounded-lg hover:bg-sky-700 disabled:opacity-50 flex items-center justify-center gap-1.5">
                        {addingMember ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add
                      </button>
                    </div>
                    {memberForm.role === 'TECHNICIAN' && (
                      <input value={memberForm.title} onChange={(e) => setMemberForm({ ...memberForm, title: e.target.value })} placeholder="Trade / title (e.g. Plumber)" className="mt-2 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                    )}
                  </div>

                  {/* Members list */}
                  {membersLoading ? (
                    <div className="text-sm text-slate-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading members…</div>
                  ) : members.length === 0 ? (
                    <p className="text-sm text-slate-400">No members yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {members.map((m) => (
                        <div key={m.id} className="flex items-center gap-3 bg-white border border-slate-200 rounded-lg px-3 py-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-slate-900">
                                {m.user.firstName || m.user.lastName ? `${m.user.firstName ?? ''} ${m.user.lastName ?? ''}`.trim() : m.user.email}
                              </span>
                              {m.role === 'TECHNICIAN' && m.title && <span className="text-xs text-slate-400 flex items-center gap-1"><Wrench className="w-3 h-3" />{m.title}</span>}
                            </div>
                            <span className="text-xs text-slate-400 flex items-center gap-1"><Mail className="w-3 h-3" />{m.user.email}</span>
                          </div>
                          <select value={m.role} onChange={(e) => changeRole(org.id, m.id, e.target.value)} className={`text-xs font-medium rounded-full px-2 py-1 border-0 ${ROLE_COLORS[m.role]}`}>
                            {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r.charAt(0) + r.slice(1).toLowerCase()}</option>)}
                          </select>
                          <button onClick={() => removeMember(org.id, m.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
