import { normalizeFileUrl } from '@/lib/utils/api-url'
import type { AgreementOffice } from '@/lib/api/client'

/**
 * The top of a viewing agreement: the logo from Settings → Branding, and the
 * office from Settings → Chat assistant → Office. The PDF prints the same.
 */
export function AgreementLetterhead({ logoUrl, office }: { logoUrl?: string | null; office?: AgreementOffice | null }) {
  const name = office?.name || 'PropGroup'
  return (
    <div className="mb-5 flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logoUrl ? normalizeFileUrl(logoUrl) : '/logo.png'} alt={name} className="h-12 w-auto max-w-[45%] object-contain object-left" />
      {office && (office.address || office.phone) && (
        <div className="min-w-0 text-right text-xs leading-relaxed text-slate-500">
          <p className="font-semibold text-slate-800">{name}</p>
          {office.address && <p>{office.address}</p>}
          {office.phone && (
            <p><a href={`tel:${office.phone.replace(/[^\d+]/g, '')}`} className="hover:text-slate-800">{office.phone}</a></p>
          )}
        </div>
      )}
    </div>
  )
}
