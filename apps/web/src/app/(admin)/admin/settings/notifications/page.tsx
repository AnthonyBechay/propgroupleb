'use client'

import { PageHeader, FormSection } from '@/components/admin/ui/layout'
import { PushToggle } from '../../crm/PushToggle'

export default function NotificationsPage() {
  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Notifications"
        description="Get a notification on this phone or computer when a client writes on WhatsApp or Instagram."
        backHref="/admin/settings"
        backLabel="Back to settings"
        crumbs={[{ label: 'Settings', href: '/admin/settings' }, { label: 'Notifications' }]}
      />
      <FormSection title="This device" description="Each phone or computer is switched on separately, by whoever uses it.">
        <PushToggle />
      </FormSection>
      <FormSection className="mt-4" tone="muted" title="On a phone">
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-700">
          <li><strong>iPhone:</strong> open the Inbox in Safari, tap Share → Add to Home Screen, then open it from the Home Screen and switch notifications on there. Safari itself cannot receive them.</li>
          <li><strong>Android:</strong> in Chrome, open the Inbox and tap Install (or Add to Home screen), then switch notifications on.</li>
        </ul>
      </FormSection>
    </div>
  )
}
