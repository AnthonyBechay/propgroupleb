import type { Metadata } from 'next'

// Staff previews of listings that may be hidden: never indexed.
export const metadata: Metadata = {
  title: 'Listing preview',
  robots: { index: false, follow: false },
}

export default function PreviewLayout({ children }: { children: React.ReactNode }) {
  return children
}
