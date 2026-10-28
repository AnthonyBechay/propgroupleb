'use client'

import { PageHeader } from '@/components/admin/ui/layout'
import { AccountSettings } from '../AccountSettings'

export default function Page() {
  return (
    <>
      <PageHeader
        title="Profile"
        description="Your name, phone and country."
        backHref="/admin/settings"
        backLabel="Back to settings"
        crumbs={[{ label: 'Settings', href: '/admin/settings' }, { label: 'Profile' }]}
      />
      <AccountSettings section="profile" />
    </>
  )
}
