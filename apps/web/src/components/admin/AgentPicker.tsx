'use client'

/**
 * Who from the office handles this property.
 *
 * `Building.agentId` is a real column, `BUILDING_DETAIL_INCLUDE` fetches the
 * agent with their bio and company, and the public listing page renders a whole
 * agent card from it — name, company, contact. Nothing in the entire web app
 * ever set it, so that card has never appeared on a single property. The
 * feature existed end to end except for the one input that would populate it.
 *
 * A plain select rather than a typeahead: an agency has a handful of agents,
 * not hundreds, and a dropdown you can see all of beats a search box you have
 * to guess at.
 */

import { useEffect, useState } from 'react'
import { Loader2, UserRound } from 'lucide-react'
import { normalizeApiUrl } from '@/lib/utils/api-url'
import { Field, SelectInput } from './ui/form'

interface AgentOption {
  id: string
  email: string
  firstName?: string | null
  lastName?: string | null
  agentCompany?: string | null
  role: string
}

function agentName(a: AgentOption): string {
  const full = [a.firstName, a.lastName].filter(Boolean).join(' ').trim()
  return full || a.email
}

export function AgentPicker({
  value, onChange, disabled,
}: {
  value: string
  onChange: (agentId: string) => void
  disabled?: boolean
}) {
  const [agents, setAgents] = useState<AgentOption[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
    // Admins list as agents too — in a small office the person who added the
    // property is usually the person handling it, and excluding them would
    // mean the field is empty for most of the team.
    Promise.all(
      ['AGENT', 'ADMIN', 'SUPER_ADMIN'].map((role) =>
        fetch(`${apiUrl}/api/users?role=${role}&limit=100`, { credentials: 'include' })
          .then((r) => (r.ok ? r.json() : null))
          .then((j) => (j?.data ?? []) as AgentOption[])
          .catch(() => [] as AgentOption[]),
      ),
    )
      .then((groups) => {
        const seen = new Set<string>()
        const merged: AgentOption[] = []
        for (const g of groups) {
          for (const a of g) {
            if (seen.has(a.id)) continue
            seen.add(a.id)
            merged.push(a)
          }
        }
        merged.sort((a, b) => agentName(a).localeCompare(agentName(b)))
        setAgents(merged)
      })
      .finally(() => setLoading(false))
  }, [])

  const selected = agents.find((a) => a.id === value)

  return (
    <Field
      label="Handled by"
      optional
      hint={
        loading
          ? 'Loading the team…'
          : selected
            ? 'Their name and contact details show on the public property page.'
            : 'Leave empty and the property page shows no agent.'
      }
    >
      <div className="relative">
        <SelectInput
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled || loading}
          className="pl-9"
        >
          <option value="">No agent assigned</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {agentName(a)}{a.agentCompany ? ` — ${a.agentCompany}` : ''}
            </option>
          ))}
          {/* An agent who has since been deleted or had their role changed
              would otherwise vanish from the list and silently unassign
              themselves on the next save. */}
          {value && !selected && !loading && (
            <option value={value}>Currently assigned (no longer in the team list)</option>
          )}
        </SelectInput>
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserRound className="h-4 w-4" />}
        </span>
      </div>
    </Field>
  )
}
