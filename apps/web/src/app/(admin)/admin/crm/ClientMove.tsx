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
  to === 'LOST' || to === 'NOISE' || to === 'QUIET' || to.startsWith('PING:')

/**
 * What a plain move asks first, sends, and says afterwards. One wording for the
 * board, the client card and the chat, so the same choice reads the same way
 * wherever it is made.
 */
export function plainMoveCopy(to: ClientMove, name: string) {
  const days = to.startsWith('PING:') ? Number(to.slice(5)) : 0
  return {
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
      : to === 'QUIET' ? 'They come back by themselves when they write or you log a call.'
      : to === 'LOST' ? 'Off the board. Find them under Lost on the Clients page.' : 'Back in "To answer" on the day.',
  }
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
  lead: { id: string; name: string; market?: string | null; type?: LeadType | null; intents?: LeadType[] | null; flaggedAt?: string | null }
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
      const copy = plainMoveCopy(to, lead.name)
      if (copy.confirm && !window.confirm(copy.confirm)) return
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
