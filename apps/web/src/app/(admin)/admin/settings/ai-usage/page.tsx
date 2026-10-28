'use client'

import { PageHeader } from '@/components/admin/ui/layout'
import { AiUsagePanel } from '../../crm/AiUsagePanel'

export default function AiUsagePage() {
  return (
    <div className="max-w-3xl">
      <PageHeader
        title="AI usage and budget"
        description="What the chat assistant and SEO writing have cost. All AI stops when the daily or monthly budget is reached."
        backHref="/admin/settings"
        backLabel="Back to settings"
        crumbs={[{ label: 'Settings', href: '/admin/settings' }, { label: 'AI usage' }]}
      />
      <AiUsagePanel />
    </div>
  )
}
