'use client'

import { PageHeader } from '@/components/admin/ui/layout'
import { AdsPanel } from '../../crm/AdsPanel'

/**
 * The Meta ad account and the Conversions API check. It used to sit at the
 * bottom of the CRM Overview, where it was setup to look at once, not a number
 * to read every day.
 */
export default function AdsSettingsPage() {
  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Meta ads"
        description="Spend and leads from the Facebook / Instagram ad account, and the check that viewings and sales are reported back to Meta."
        backHref="/admin/settings"
        backLabel="Back to settings"
        crumbs={[{ label: 'Settings', href: '/admin/settings' }, { label: 'Meta ads' }]}
      />
      <AdsPanel />
    </div>
  )
}
