'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, UserPlus } from 'lucide-react'
import { API_URL } from '@/lib/api/use-admin-data'

/**
 * Whose client is this — shown as initials on every card, changed in one tap.
 *
 * It labels, it never hides: everyone still sees every client. A client can
 * have one person or several. Whoever adds a client or first replies to them
 * is put on it automatically (see the backend's assignment.service.ts), so
 * most cards have a name without anybody doing anything.
 */

export interface TeamMember { id: string; name: string; initials: string }

// One request for the whole app session; three people do not change by the minute.
let cache: Promise<TeamMember[]> | null = null
function loadTeam(): Promise<TeamMember[]> {
  cache ??= fetch(`${API_URL}/api/crm/team`, { credentials: 'include', cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error('team'))))
    .then((j) => (j.data ?? []) as TeamMember[])
    .catch(() => { cache = null; return [] })
  return cache
}

export function useTeam(): TeamMember[] {
  const [team, setTeam] = useState<TeamMember[]>([])
  useEffect(() => {
    let alive = true
    void loadTeam().then((t) => { if (alive) setTeam(t) })
    return () => { alive = false }
  }, [])
  return team
}

/** A steady colour per person, so a board can be read by colour alone. */
const TINTS = ['#0369a1', '#b45309', '#7c3aed', '#0f766e', '#be185d', '#4d7c0f', '#b91c1c', '#475569']
export function tintOf(team: TeamMember[], id: string): string {
  const i = team.findIndex((t) => t.id === id)
  return TINTS[(i < 0 ? 0 : i) % TINTS.length]
}

export function Bubble({ member, team, size = 20 }: { member: TeamMember; team: TeamMember[]; size?: number }) {
  return (
    <span
      title={member.name}
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ring-2 ring-white"
      style={{ width: size, height: size, fontSize: size * 0.42, background: tintOf(team, member.id) }}
    >
      {member.initials}
    </span>
  )
}

export async function assign(leadId: string, userIds: string[]): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/api/crm/${leadId}/assign`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userIds }),
    })
    return res.ok
  } catch {
    return false
  }
}

/**
 * The initials on a card. Tap to tick or untick people.
 *
 * The list opens on <body>, not inside the card: the board's columns scroll,
 * and anything positioned inside one is cut off at its edge.
 */
export function AssigneePicker({
  leadId, value, team, onChanged, size = 20, showEmpty = true,
}: {
  leadId: string
  value: string[]
  team: TeamMember[]
  /** Called after a change has been saved. */
  onChanged?: (next: string[]) => void
  size?: number
  /** Show a faint "assign" button when nobody is on it. */
  showEmpty?: boolean
}) {
  const [ids, setIds] = useState(value)
  const [at, setAt] = useState<{ top: number; left: number } | null>(null)
  const button = useRef<HTMLButtonElement>(null)
  const pop = useRef<HTMLDivElement>(null)
  // Follow the record when the board refreshes underneath.
  const key = value.join(',')
  useEffect(() => setIds(value), [key]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!at) return
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !pop.current?.contains(e.target as Node) && !button.current?.contains(e.target as Node)) setAt(null)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close) }
  }, [at])

  if (team.length === 0) return null
  const people = ids.map((id) => team.find((t) => t.id === id)).filter((t): t is TeamMember => Boolean(t))
  if (people.length === 0 && !showEmpty) return null

  const open = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (at) { setAt(null); return }
    const r = button.current?.getBoundingClientRect()
    if (!r) return
    const height = team.length * 44 + 44
    setAt({
      top: r.bottom + height > window.innerHeight ? Math.max(8, r.top - height - 4) : r.bottom + 4,
      left: Math.max(8, Math.min(r.left, window.innerWidth - 228)),
    })
  }

  const toggle = async (id: string) => {
    const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]
    const before = ids
    setIds(next)
    if (await assign(leadId, next)) onChanged?.(next)
    else setIds(before)
  }

  return (
    <>
      <button
        ref={button}
        type="button"
        onClick={open}
        aria-haspopup="true"
        aria-expanded={Boolean(at)}
        title={people.length ? `With ${people.map((p) => p.name).join(' and ')} — change` : 'Nobody is looking after them — assign'}
        className="inline-flex shrink-0 items-center rounded-full p-0.5 hover:bg-slate-200/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
      >
        {people.length ? (
          <span className="flex -space-x-1.5">
            {people.map((p) => <Bubble key={p.id} member={p} team={team} size={size} />)}
          </span>
        ) : (
          <span
            className="inline-flex items-center justify-center rounded-full border border-dashed border-slate-300 text-slate-400"
            style={{ width: size, height: size }}
          >
            <UserPlus style={{ width: size * 0.55, height: size * 0.55 }} />
          </span>
        )}
      </button>
      {at && createPortal(
        <div
          ref={pop}
          role="menu"
          onClick={(e) => e.stopPropagation()}
          className="fixed z-[70] w-[220px] rounded-xl border border-slate-200 bg-white p-1 shadow-xl"
          style={{ top: at.top, left: at.left }}
        >
          <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Looked after by</p>
          {team.map((t) => {
            const on = ids.includes(t.id)
            return (
              <button
                key={t.id}
                type="button"
                role="menuitemcheckbox"
                aria-checked={on}
                onClick={() => void toggle(t.id)}
                className="flex min-h-11 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-sm text-slate-800 hover:bg-slate-50"
              >
                <Bubble member={t} team={team} size={22} />
                <span className="min-w-0 flex-1 truncate">{t.name}</span>
                {on && <Check className="h-4 w-4 shrink-0 text-emerald-600" />}
              </button>
            )
          })}
        </div>,
        document.body,
      )}
    </>
  )
}
