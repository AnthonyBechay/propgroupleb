'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { CheckCircle2, X } from 'lucide-react'

/**
 * Shown once on the landing page after an owner submits their property
 * (redirected here with ?submitted=1). Auto-dismisses and strips the query
 * param so a refresh doesn't show it again.
 */
export function SubmissionSuccessBanner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (searchParams.get('submitted') === '1') {
      setShow(true)
      // Remove the flag from the URL without adding a history entry.
      const params = new URLSearchParams(searchParams.toString())
      params.delete('submitted')
      router.replace(params.toString() ? `${pathname}?${params.toString()}` : pathname, { scroll: false })
      const t = setTimeout(() => setShow(false), 9000)
      return () => clearTimeout(t)
    }
  }, [searchParams, router, pathname])

  if (!show) return null

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3.5 shadow-sm">
      <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-emerald-900">Thank you — your property was submitted!</p>
        <p className="text-sm text-emerald-800/90 mt-0.5">
          Our team will review the details and contact you shortly to confirm before publishing. Zero commission, as promised.
        </p>
      </div>
      <button onClick={() => setShow(false)} className="text-emerald-600/70 hover:text-emerald-900 shrink-0" aria-label="Dismiss">
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
