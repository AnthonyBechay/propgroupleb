'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'

/**
 * The reference code, tap-to-copy.
 *
 * The code exists so a client can paste it into WhatsApp and tell us which
 * property they mean — making them retype it by hand is the one thing that
 * would stop them bothering.
 */
export function CopyRef({ refCode }: { refCode: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(refCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // Clipboard blocked (insecure context, permissions) — the code is still
      // on screen to read, so there's nothing useful to tell the user.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      title="Copy reference"
      aria-label={`Copy reference ${refCode}`}
      className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded px-2 py-1 transition-colors"
    >
      Ref {refCode}
      {copied ? (
        <Check className="h-3 w-3 text-emerald-600" />
      ) : (
        <Copy className="h-3 w-3 text-slate-400" />
      )}
      <span className="sr-only" aria-live="polite">{copied ? 'Copied' : ''}</span>
    </button>
  )
}
