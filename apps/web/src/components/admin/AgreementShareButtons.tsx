'use client'

import { useState } from 'react'
import { Download, Loader2, MessageCircle, RotateCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { savePdf, sharePdfViaWhatsApp, useAgreementPdf, type AgreementShareInfo } from '@/lib/share-agreement'

/**
 * "Send on WhatsApp" and "Save PDF" for a signed agreement. The PDF is fetched
 * as soon as this renders, so the tap can open the share sheet immediately
 * (see lib/share-agreement.ts for why that matters on an iPhone).
 */
export function AgreementShareButtons({ agreement, className, stacked }: { agreement: AgreementShareInfo; className?: string; stacked?: boolean }) {
  const { file, error, retry } = useAgreementPdf(agreement.id)
  const [hint, setHint] = useState<string | null>(null)

  const btn = 'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 text-base font-medium disabled:opacity-50'

  if (error) {
    return (
      <div className={cn('rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700', className)}>
        {error}
        <button type="button" onClick={retry} className="ml-2 inline-flex min-h-11 items-center gap-1 font-medium underline">
          <RotateCw className="h-3.5 w-3.5" /> Try again
        </button>
      </div>
    )
  }

  return (
    <div className={className}>
      <div className={cn('flex gap-3', stacked ? 'flex-col' : 'flex-col sm:flex-row')}>
        <button
          type="button"
          disabled={!file}
          onClick={async () => {
            if (!file) return
            setHint(null)
            const outcome = await sharePdfViaWhatsApp(file, agreement)
            if (outcome === 'fallback') setHint('The PDF was downloaded and WhatsApp opened with a message ready. Attach the PDF to send it.')
          }}
          className={cn(btn, 'bg-[#25D366] text-white hover:bg-[#1ebe5a]')}
        >
          {file ? <MessageCircle className="h-5 w-5" /> : <Loader2 className="h-5 w-5 animate-spin" />}
          {file ? 'Send on WhatsApp' : 'Preparing PDF…'}
        </button>
        <button
          type="button"
          disabled={!file}
          onClick={() => file && savePdf(file, agreement.ref)}
          className={cn(btn, 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50')}
        >
          <Download className="h-5 w-5" /> Save / print PDF
        </button>
      </div>
      {hint && <p className="mt-2 text-sm text-slate-600">{hint}</p>}
    </div>
  )
}
