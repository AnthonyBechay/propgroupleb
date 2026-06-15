'use client'

import { useEffect, useState, useCallback } from 'react'
import { Wrench, AlertTriangle, Building2, Loader2 } from 'lucide-react'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { apiClient } from '@/lib/api/client'
import { normalizeApiUrl } from '@/lib/utils/api-url'

const PRIORITY_COLORS: Record<string, string> = {
  EMERGENCY: 'bg-red-100 text-red-700',
  HIGH: 'bg-orange-100 text-orange-700',
  NORMAL: 'bg-blue-100 text-blue-700',
  LOW: 'bg-slate-100 text-slate-500',
}
const STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-amber-100 text-amber-700',
  TRIAGED: 'bg-sky-100 text-sky-700',
  SCHEDULED: 'bg-violet-100 text-violet-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  RESOLVED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-slate-100 text-slate-500',
}

/** A technician's own assigned maintenance jobs. */
export default function MyJobsPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [jobs, setJobs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
      const res = await fetch(`${apiUrl}/api/tickets/assigned-to-me?limit=100`, { credentials: 'include' })
      const j = await res.json().catch(() => ({}))
      setJobs(j.data ?? [])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function setStatus(id: string, status: string) {
    try { await apiClient.updateTicket(id, { status } as never); load() } catch { /* ignore */ }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Wrench className="h-6 w-6 text-slate-700" /> My Jobs
        </h1>
        <p className="text-slate-500 text-sm mt-0.5">Maintenance tickets assigned to you.</p>
      </div>

      {loading ? (
        <div className="py-16 text-center text-slate-400 flex items-center justify-center gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Loading…</div>
      ) : jobs.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 py-16 text-center text-slate-400">
          No jobs assigned to you right now.
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((t) => (
            <div key={t.id} className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  {t.priority === 'EMERGENCY' && <AlertTriangle className="h-3.5 w-3.5 text-red-500" />}
                  <span className="font-medium text-slate-900">{t.title}</span>
                  <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${PRIORITY_COLORS[t.priority] ?? ''}`}>{t.priority}</span>
                </div>
                <div className="flex items-center gap-1 mt-1 text-xs text-slate-400">
                  <Building2 className="h-3 w-3" />
                  {t.building?.title ?? '—'}{t.unit?.unitNumber ? ` · #${t.unit.unitNumber}` : ''}
                </div>
                {t.description && <p className="text-sm text-slate-500 mt-1.5 line-clamp-2">{t.description}</p>}
              </div>
              <Select value={t.status} onValueChange={(v) => setStatus(t.id, v)}>
                <SelectTrigger className={`h-8 w-[150px] text-xs font-medium ${STATUS_COLORS[t.status] ?? ''}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OPEN">Open</SelectItem>
                  <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                  <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                  <SelectItem value="RESOLVED">Resolved</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
