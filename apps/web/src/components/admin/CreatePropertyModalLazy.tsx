'use client'

import dynamic from 'next/dynamic'
import type { ReactNode } from 'react'

// Client wrapper that defers loading the ~hundreds-of-lines property form
// until the Create button is actually mounted. The server admin page stays
// lightweight; the form chunk only loads on the admin route that renders it.
const CreatePropertyModal = dynamic(
  () => import('./PropertyFormModal').then(m => ({ default: m.CreatePropertyModal })),
  { ssr: false, loading: () => null },
)

interface Props {
  developers: any[]
  locationGuides: any[]
  children: ReactNode
}

export function CreatePropertyModalLazy(props: Props) {
  return <CreatePropertyModal {...props} />
}
