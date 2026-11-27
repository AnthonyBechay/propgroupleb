'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { normalizeApiUrl } from '@/lib/utils/api-url'

/**
 * The outside broker who brought this property.
 *
 * Brokers used to be typed in as the owner, which made a broker look like the
 * client selling and left the deal with no broker to pay. A broker is a
 * `Broker` (Brokers screen), not a CRM client: deals on this property get him
 * by default, so his cut is worked out when it sells.
 */

export type BrokerRef = { id: string; name: string; company?: string | null }

interface BrokerRow { id: string; name: string; company?: string | null; active: boolean; sharePct?: number }

export function BrokerPicker({
  value,
  onChange,
  disabled,
}: {
  value: BrokerRef | null
  onChange: (broker: BrokerRef | null) => void
  disabled?: boolean
}) {
  const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
  const [brokers, setBrokers] = useState<BrokerRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    fetch(`${apiUrl}/api/finance/brokers`, { credentials: 'include', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((j) => { if (live) setBrokers(j?.data ?? []) })
      .catch(() => { if (live) { setBrokers([]); setError('Could not load the brokers.') } })
    return () => { live = false }
  }, [apiUrl])

  // An inactive broker already on the property stays listed so the select
  // shows him rather than silently reading "No broker".
  const options = (brokers ?? []).filter((b) => b.active || b.id === value?.id)
  if (value && !options.some((b) => b.id === value.id)) options.unshift({ ...value, active: false })

  return (
    <div>
      <label htmlFor="property-broker" className="block text-sm font-medium text-slate-700 mb-1.5">Broker</label>
      <select
        id="property-broker"
        value={value?.id ?? ''}
        disabled={disabled || brokers === null}
        onChange={(e) => {
          const b = options.find((x) => x.id === e.target.value)
          onChange(b ? { id: b.id, name: b.name, company: b.company ?? null } : null)
        }}
        className="min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
      >
        <option value="">{brokers === null ? 'Loading…' : 'No broker'}</option>
        {options.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}{b.company ? ` — ${b.company}` : ''}{b.sharePct != null ? ` (${b.sharePct}%)` : ''}{!b.active ? ' · inactive' : ''}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      <p className="text-xs text-slate-500 mt-1">
        An outside broker who brought this property. Deals on it get him by default, so his cut is counted on sale.{' '}
        <Link href="/admin/brokers" className="underline hover:text-slate-700">Manage brokers</Link>
      </p>
    </div>
  )
}
