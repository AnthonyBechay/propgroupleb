'use client'

import { useEffect } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { reloadIfBuildChanged, reportProblem } from '@/lib/utils/client-problems'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Application error:', error)
    if (!reloadIfBuildChanged(error)) reportProblem('crash', error.message, error.stack)
  }, [error])

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Something went wrong</h2>
        <p className="text-sm text-slate-600 mb-6">
          An unexpected error occurred. Please try again or contact support if the problem persists.
        </p>
        <Button
          onClick={reset}
          className="bg-slate-900 hover:bg-slate-800 text-white"
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Try Again
        </Button>
        {/* The installed app has no reload button of its own. */}
        <Button onClick={() => window.location.reload()} variant="outline" className="ml-2">
          Reload
        </Button>
      </div>
    </div>
  )
}
