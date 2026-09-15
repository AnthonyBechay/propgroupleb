'use client'

/**
 * The back office's confirmation dialog, replacing `window.confirm`.
 *
 * `confirm()` was used for deletes that cascade — a unit and its listings, a
 * property and every photo in R2 — and it cannot say any of that. It renders a
 * bare sentence with two identical-looking buttons, focuses the confirming one,
 * and on a phone it's a system sheet with no room for consequences. Everything
 * destructive in here now states what it removes and what it cannot undo.
 *
 * `requireText` is for the irreversible ones: typing the name is the difference
 * between deciding and mis-tapping.
 */

import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export function ConfirmDialog({
  open, title, description, confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  tone = 'default', busy, requireText, consequences, onConfirm, onClose,
}: {
  open: boolean
  title: React.ReactNode
  description?: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'default' | 'danger'
  busy?: boolean
  /** When set, the confirm button unlocks only once this exact text is typed. */
  requireText?: string
  /** Bullet list of what this actually does — shown above the buttons. */
  consequences?: React.ReactNode[]
  onConfirm: () => void
  onClose: () => void
}) {
  const [typed, setTyped] = useState('')
  const cancelRef = useRef<HTMLButtonElement>(null)

  // Focus lands on Cancel, never on the destructive action: a stray Enter from
  // whatever the admin was doing before must not confirm a delete.
  useEffect(() => {
    if (open) { setTyped(''); cancelRef.current?.focus() }
  }, [open])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [open, onClose])

  if (!open) return null

  const locked = !!requireText && typed.trim() !== requireText.trim()
  const danger = tone === 'danger'

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div
        className="absolute inset-0"
        onClick={() => !busy && onClose()}
        aria-hidden="true"
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="relative w-full max-w-md overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
      >
        <div className="flex items-start gap-3 p-5">
          <div
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
              danger ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-600',
            )}
          >
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="confirm-title" className="font-semibold text-slate-900">{title}</h2>
            {description && <div className="mt-1 text-sm text-slate-500">{description}</div>}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="-mr-1 -mt-1 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {consequences && consequences.length > 0 && (
          <ul className="mx-5 mb-4 space-y-1.5 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
            {consequences.map((c, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-400" aria-hidden="true" />
                <span className="min-w-0">{c}</span>
              </li>
            ))}
          </ul>
        )}

        {requireText && (
          <div className="mx-5 mb-4">
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Type <span className="font-semibold text-slate-900">{requireText}</span> to confirm
            </label>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className="min-h-11 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              placeholder={requireText}
              autoComplete="off"
            />
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-3">
          <button
            ref={cancelRef}
            type="button"
            onClick={onClose}
            disabled={busy}
            className="min-h-11 rounded-lg px-4 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-200/60 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy || locked}
            className={cn(
              'inline-flex min-h-11 items-center gap-2 rounded-lg px-4 text-sm font-semibold text-white transition-colors disabled:opacity-50',
              danger ? 'bg-red-600 hover:bg-red-700' : 'bg-slate-800 hover:bg-slate-700',
            )}
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
