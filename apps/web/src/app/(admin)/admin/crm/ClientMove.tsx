'use client'

import { useState } from 'react'
import { normalizeApiUrl } from '@/lib/utils/api-url'
import { toast } from '@/components/ui/toast'
import { MoveMenu, type ClientMove } from './DealBoard'
import { BookViewingModal, type StartStage } from './BookViewingModal'
import { type Lead, type LeadType, stageLabel } from './types'

const SUPPLY: LeadType[] = ['SELLER', 'LANDLORD']

/**
 * Flag a client red for the team, or clear it. Asks why first — a red card
 * nobody can explain gets ignored. Resolves to true when it saved.
 */
export async function flagClient(apiUrl: string, leadId: string, name: string, flag: boolean): Promise<boolean> {
  let note: string | undefined
  if (flag) {
    const typed = window.prompt(`Flag ${name} for the team.\n\nWhat should they check? (optional)`, '')
    if (typed === null) return false
    note = typed.trim() || undefined
  }
  try {
    const res = await fetch(`${apiUrl}/api/crm/pipeline/${leadId}/flag`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(flag ? { note } : { clear: true }),
      signal: AbortSignal.timeout(20_000),
    })
    if (!res.ok) throw new Error()
  } catch {
    alert('That did not save — nothing was changed. Try again.')
    return false
  }
  toast({ title: flag ? `${name}: flagged` : `${name}: flag removed`, description: flag ? 'Their cards show red on the board until someone clears it.' : undefined })
  return true
}

/** A move that needs no property: it waits, or it ends. */
export const isPlainMove = (to: ClientMove) =>
  to === 'LOST' || to === 'NOISE' || to === 'QUIET' || to === 'UNHOLD' || to.startsWith('PING:') || to.startsWith('HOLD:')

/**
 * What a plain move asks first, sends, and says afterwards. One wording for the
 * board, the client card and the chat, so the same choice reads the same way
 * wherever it is made.
 */
export function plainMoveCopy(to: ClientMove, name: string) {
  const days = to.startsWith('PING:') ? Number(to.slice(5)) : 0
  if (to.startsWith('HOLD:') || to === 'UNHOLD') {
    const parked = to === 'HOLD:PARKED'
    return {
      confirm: null,
      ask: to === 'UNHOLD' ? null : parked
        ? `Park ${name} for now.\n\nWhat are you waiting for? (optional)`
        : `Checking something for ${name}.\n\nWhat are you checking? (optional, e.g. "asking the developer about the 3rd floor")`,
      body: to === 'UNHOLD' ? { action: 'unhold' } : { action: 'hold', kind: parked ? 'PARKED' : 'CHECKING' },
      title: to === 'UNHOLD' ? `${name}: off hold` : parked ? `${name}: parked` : `${name}: checking for them`,
      description: to === 'UNHOLD'
        ? 'Back in the column their chat puts them in.'
        : 'In "On hold" until someone moves them. If they write, they show in "To answer".',
    }
  }
  return {
    ask: null as string | null,
    confirm: to === 'NOISE'
      ? `Mark ${name} as noise?\n\nThey leave the board and the inbox, and come back by themselves if they ever write again.`
      : to === 'LOST'
        ? `Mark ${name} as not interested?\n\nThey leave the board and stay in the client list. Their open deals close as "not this property", so what they were shown stays on record.`
        : null,
    body: to === 'NOISE' ? { action: 'noise' }
      : to === 'QUIET' ? { action: 'quiet' }
      : to === 'LOST' ? { action: 'not_interested' }
      : { action: 'ping_later', days },
    title: to === 'NOISE' ? `${name}: noise`
      : to === 'QUIET' ? `${name}: gone quiet`
      : to === 'LOST' ? `${name}: not interested`
      : `${name}: ping in ${days === 30 ? 'a month' : days === 7 ? 'a week' : `${days} days`}`,
    description: to === 'NOISE'
      ? 'Off the board and out of the inbox until they write again.'
      : to === 'QUIET' ? 'Off the board — on the Clients page under Gone quiet. They come back by themselves when they write or you log a call.'
      : to === 'LOST' ? 'Off the board. Find them under Lost on the Clients page.' : 'Back in "To answer" on the day.',
  }
}

/**
 * Everything a plain move asks before it is sent — the confirm, or the note
 * for a hold — and what to send. Null when the person cancelled.
 */
export function preparePlainMove(to: ClientMove, name: string) {
  const copy = plainMoveCopy(to, name)
  if (copy.confirm && !window.confirm(copy.confirm)) return null
  let body: Record<string, unknown> = copy.body
  if (copy.ask) {
    const typed = window.prompt(copy.ask, '')
    if (typed === null) return null
    if (typed.trim()) body = { ...body, note: typed.trim().slice(0, 200) }
  }
  return { ...copy, body }
}

/**
 * The board's Move menu, for one client, anywhere — the chat header and the
 * client card. Reading a conversation to remember where things stand and then
 * having to go back to the board, find the card again and move it there was
 * the whole complaint.
 */
export function ClientMoveButton({
  lead, onMoved, buttonClassName,
}: {
  lead: { id: string; name: string; market?: string | null; type?: LeadType | null; intents?: LeadType[] | null; flaggedAt?: string | null; holdAt?: string | null }
  /** After the move saved: refresh whatever shows this client. */
  onMoved?: (to: ClientMove) => void
  buttonClassName?: string
}) {
  const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
  const [booking, setBooking] = useState<{ lead: Lead; stage: StartStage } | null>(null)
  const intents = lead.intents?.length ? lead.intents : lead.type ? [lead.type] : []
  const supplyOnly = intents.length > 0 && intents.every((t) => SUPPLY.includes(t))

  const pick = async (to: ClientMove) => {
    if (to === 'FLAG' || to === 'UNFLAG') {
      if (await flagClient(apiUrl, lead.id, lead.name, to === 'FLAG')) onMoved?.(to)
      return
    }
    if (isPlainMove(to)) {
      const copy = preparePlainMove(to, lead.name)
      if (!copy) return
      try {
        const res = await fetch(`${apiUrl}/api/crm/pipeline/${lead.id}/action`, {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(copy.body),
          signal: AbortSignal.timeout(20_000),
        })
        if (!res.ok) throw new Error()
      } catch {
        alert('That did not save — nothing was changed. Try again.')
        return
      }
      toast({ title: copy.title, description: copy.description })
      onMoved?.(to)
      return
    }
    // A deal stage: which property is it about? The full record, so the
    // picker can offer what is already shortlisted for them by name.
    try {
      const res = await fetch(`${apiUrl}/api/crm/${lead.id}`, { credentials: 'include', cache: 'no-store', signal: AbortSignal.timeout(20_000) })
      const full = res.ok ? (await res.json()).data : null
      if (!full) throw new Error()
      setBooking({ lead: full, stage: to as StartStage })
    } catch {
      alert('Could not load this client. Check your connection and try again.')
    }
  }

  return (
    <>
      <MoveMenu
        meeting={lead.market !== 'LEBANON'}
        supplyOnly={supplyOnly}
        flagged={Boolean(lead.flaggedAt)}
        held={Boolean(lead.holdAt)}
        onPick={(to) => { void pick(to) }}
        buttonClassName={buttonClassName}
      />
      {booking && (
        <BookViewingModal
          lead={booking.lead}
          stage={booking.stage}
          onClose={() => setBooking(null)}
          onBooked={() => {
            toast({ title: `${lead.name} → ${stageLabel(booking.stage, booking.lead.market)}`, description: 'On the board as a deal now.' })
            const stage = booking.stage
            setBooking(null)
            onMoved?.(stage)
          }}
        />
      )}
    </>
  )
}
