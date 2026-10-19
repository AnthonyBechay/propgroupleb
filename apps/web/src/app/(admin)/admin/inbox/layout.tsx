import type { Metadata, Viewport } from 'next'

/**
 * The inbox as an app on the phone's home screen (Safari → Share → Add to Home
 * Screen). The manifest opens it straight on the inbox, full screen, with no
 * browser bars. Only this page carries it: "Add to Home Screen" from the public
 * site should stay a bookmark of the site, not an app that opens the back office.
 */
export const metadata: Metadata = {
  title: 'Inbox',
  manifest: '/inbox.webmanifest',
  appleWebApp: { capable: true, title: 'Inbox', statusBarStyle: 'default' },
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  themeColor: '#ffffff',
  // Lets the page reach the screen's edges in the installed app; the chat pads
  // itself clear of the notch and the home bar with env(safe-area-inset-*).
  viewportFit: 'cover',
}

export default function InboxLayout({ children }: { children: React.ReactNode }) {
  return children
}
