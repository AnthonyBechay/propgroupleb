'use client'

import { useEffect } from 'react'
import { reloadIfBuildChanged, reportProblem } from '@/lib/utils/client-problems'

/**
 * The last resort, when the root layout itself fails. Without this file Next
 * shows a bare white page, and the installed Inbox app has no reload button to
 * get out of it. It replaces the whole document, so the styles are its own.
 */
export default function RootError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    if (!reloadIfBuildChanged(error)) reportProblem('crash', error.message, error.stack)
  }, [error])

  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', fontFamily: 'system-ui, sans-serif', padding: 24, boxSizing: 'border-box' }}>
        <div style={{ textAlign: 'center', maxWidth: 360 }}>
          <h1 style={{ fontSize: 20, color: '#0f172a', margin: '0 0 8px' }}>Something went wrong</h1>
          <p style={{ fontSize: 14, color: '#475569', margin: '0 0 20px' }}>Reload to pick up where you were.</p>
          <button
            onClick={() => window.location.reload()}
            style={{ minHeight: 44, padding: '0 20px', border: 0, borderRadius: 8, background: '#0f172a', color: '#fff', fontSize: 14, fontWeight: 600 }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  )
}
