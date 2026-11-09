'use client'

import { Loader2 } from 'lucide-react'

/** What an admin page shows while its data loads, or when it could not. */
export function LoadState({ error, onRetry, label = 'Loading…' }: { error?: string | null; onRetry?: () => void; label?: string }) {
  if (error) {
    return (
      <div className="mx-auto mt-16 max-w-md rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-sm font-medium text-red-700">{error}</p>
        <p className="mt-1 text-xs text-red-600">Nothing was changed. If you were signed out, sign in again.</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 min-h-11 rounded-lg border border-red-200 bg-white px-4 text-sm font-medium text-red-700 hover:bg-red-100"
          >
            Try again
          </button>
        )}
      </div>
    )
  }
  return (
    <div className="mt-16 flex items-center justify-center gap-2 text-sm text-slate-500">
      <Loader2 className="h-4 w-4 animate-spin" /> {label}
    </div>
  )
}
