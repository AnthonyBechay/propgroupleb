'use client'

import { PageHeader } from '@/components/admin/ui/layout'
import { AccountSettings } from '../AccountSettings'

export default function Page() {
  return (
    <>
      <PageHeader
        title="Password"
        description="Change the password you sign in with."
        backHref="/admin/settings"
        backLabel="Back to settings"
        crumbs={[{ label: 'Settings', href: '/admin/settings' }, { label: 'Password' }]}
      />
      <AccountSettings section="security" />
    </>
  )
}
