'use client'

import { useEffect, useRef, useState } from 'react'
import { Bot, Check, Loader2, X } from 'lucide-react'

export type AssistantMode = 'off' | 'normal' | 'always'

/** The pause reason that means a person switched it off (backend PAUSED_BY_TEAM). */
const PAUSED_BY_TEAM = 'Paused by the team'

export function assistantMode(thread: { aiPaused: boolean; aiPausedReason?: string | null; aiAlways?: boolean }): AssistantMode {
  if (thread.aiPaused && thread.aiPausedReason === PAUSED_BY_TEAM) return 'off'
  return thread.aiAlways ? 'always' : 'normal'
}

const MODES: Array<[AssistantMode, string, string]> = [
  ['off', 'Off for this chat', 'Never answers here on its own. You can still ask it for one reply below.'],
  ['normal', 'Normal', 'Answers until someone from the team replies here, then follows the Chat assistant settings.'],
  ['always', 'Always on', 'Keeps answering even when the team replies. If it hands the client over, it waits for the team.'],
]

/**
 * The one control for the chat assistant on a conversation.
 *
 * It replaced four buttons that each answered part of one question — "will the
 * assistant reply here?" — a pause toggle, "Keep always on", "Resume for 24h"
 * and "Reply now", two of which did the same thing. Now: the button says what
 * will happen, and the panel says why and lets you change it. On a phone the
 * panel is a sheet from the bottom.
 */
export function AssistantControl({
  thread,
  status,
  canReply,
  onMode,
  onReplyNow,
}: {
  thread: { aiPaused: boolean; aiPausedReason?: string | null; aiAlways?: boolean }
  /** Would it answer the next message here, and if not, why. */
  status: { sent: boolean; reason: string }
  /** Inside WhatsApp's 24-hour window, so a reply can be sent at all. */
  canReply: boolean
  onMode: (mode: AssistantMode) => Promise<void>
  /** Asks for one reply now; resolves to what came of it. */
  onReplyNow: () => Promise<string>
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<AssistantMode | 'reply' | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const mode = assistantMode(thread)
  const handedOver = thread.aiPaused && mode !== 'off'

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (!wrapRef.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])
  useEffect(() => { if (!open) setNote(null) }, [open])

  // Past WhatsApp's 24 hours nothing can be sent, whatever the mode — so the
  // button shows the mode that WILL apply, not a "quiet" that read as if the
  // choice had not been taken.
  const closed = !canReply && mode !== 'off'
  const modeName = mode === 'always' ? 'Always on' : 'Normal'

  // [short label for a phone, full label, colour]
  const [short, full, tone] =
    mode === 'off' ? ['Off', 'Assistant off', 'border-slate-200 bg-white text-slate-600']
    : closed ? [modeName, `${modeName} · waits for client`, 'border-slate-200 bg-white text-slate-700']
    : handedOver ? ['Handed over', 'Handed over to team', 'border-amber-200 bg-amber-50 text-amber-800']
    : status.sent ? (mode === 'always' ? ['Always', 'Assistant always on', 'border-emerald-600 bg-emerald-600 text-white'] : ['On', 'Assistant on', 'border-emerald-200 bg-emerald-50 text-emerald-800'])
    : ['Quiet', 'Assistant quiet', 'border-amber-200 bg-amber-50 text-amber-800']

  const choose = async (next: AssistantMode) => {
    if (busy || next === mode && !handedOver) return
    setBusy(next)
    try { await onMode(next) } finally { setBusy(null) }
  }
  const replyNow = async () => {
    if (busy) return
    setBusy('reply')
    setNote(null)
    try { setNote(await onReplyNow()) } finally { setBusy(null) }
  }

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={`${full}. Change`}
        className={`min-h-11 px-3 rounded-lg text-sm font-medium inline-flex items-center gap-1.5 border ${tone}`}
      >
        <Bot className="h-4 w-4" />
        <span className="sm:hidden">{short}</span>
        <span className="hidden sm:inline">{full}</span>
      </button>

      {open && (
        <>
          {/* Phone: dim the chat behind the sheet; a tap on it closes. */}
          <div className="fixed inset-0 z-[55] bg-black/30 sm:hidden" onClick={() => setOpen(false)} />
          <div className="fixed inset-x-0 bottom-0 z-[60] rounded-t-2xl bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96 sm:rounded-xl sm:border sm:border-slate-200 sm:pb-4">
            <div className="flex items-start gap-2">
              <p className="flex-1 font-semibold text-slate-900">Chat assistant</p>
              <button onClick={() => setOpen(false)} aria-label="Close" className="-m-2 min-h-11 min-w-11 inline-flex items-center justify-center text-slate-500">
                <X className="h-4 w-4" />
              </button>
            </div>
            {/* What happens next, in words — the reason used to be a hover tooltip, which a phone cannot show. */}
            <p className={`mt-1 text-sm ${status.sent ? 'text-emerald-800' : 'text-slate-700'}`}>
              {note ?? (closed
                ? `Your choice is saved. WhatsApp only allows replies within 24 hours of the client's last message, so it answers as soon as they write again. To start the conversation again yourself, send the follow-up message from below the chat.`
                : status.reason)}
            </p>

            <div className="mt-3 space-y-1.5" role="radiogroup" aria-label="Assistant on this chat">
              {MODES.map(([value, title, hint]) => {
                const selected = mode === value
                return (
                  <button
                    key={value}
                    role="radio"
                    aria-checked={selected}
                    onClick={() => choose(value)}
                    disabled={busy !== null}
                    className={`w-full min-h-11 text-left rounded-lg border px-3 py-2 flex items-start gap-2.5 disabled:opacity-60 ${selected ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:bg-slate-50'}`}
                  >
                    <span className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border inline-flex items-center justify-center ${selected ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300'}`}>
                      {busy === value ? <Loader2 className="h-3 w-3 animate-spin" /> : selected ? <Check className="h-3 w-3" /> : null}
                    </span>
                    <span>
                      <span className="block text-sm font-medium text-slate-900">{title}</span>
                      <span className="block text-xs text-slate-600">{hint}</span>
                    </span>
                  </button>
                )
              })}
            </div>
            {handedOver && (
              <p className="mt-2 text-xs text-slate-600">
                It handed this client to the team. Choose a mode again to let it carry on now.
              </p>
            )}

            <button
              onClick={replyNow}
              disabled={busy !== null || !canReply}
              className="mt-3 w-full min-h-11 rounded-lg bg-slate-900 text-white text-sm font-medium inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {busy === 'reply' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
              Reply with the assistant now
            </button>
            {!canReply && (
              <p className="mt-1.5 text-xs text-slate-500">Over 24 hours since they last wrote, so no reply can be sent from here.</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
