'use client'

import Script from 'next/script'
import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'

/**
 * The Meta Pixel — tells Meta who visited the site and who sent an enquiry, so
 * ads can be shown again to visitors and to people like those who enquired.
 *
 * It reports to the same Meta dataset as the CRM (NEXT_PUBLIC_META_PIXEL_ID),
 * so website visits, chats and closed deals add up to one picture of a client.
 * Back-office, portal and sign-in pages are never reported.
 */

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID

/** Pages that are not marketing: nothing about them is sent to Meta. */
const PRIVATE = /^\/(admin|portal|agent|auth|setup|unauthorized)(\/|$)/

type Fbq = (...args: unknown[]) => void

/** Record a standard event, e.g. trackPixel('Lead'). Does nothing without the pixel. */
export function trackPixel(event: string, params?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return
  if (PRIVATE.test(window.location.pathname)) return
  const fbq = (window as unknown as { fbq?: Fbq }).fbq
  fbq?.('track', event, params)
}

export function MetaPixel() {
  const pathname = usePathname()
  const first = useRef(true)

  // The page the visitor lands on is counted by the loader below; every page
  // after that, in this single-page app, is counted here.
  useEffect(() => {
    if (first.current) { first.current = false; return }
    trackPixel('PageView')
  }, [pathname])

  if (!PIXEL_ID) return null

  return (
    <Script id="meta-pixel" strategy="afterInteractive">
      {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init', ${JSON.stringify(PIXEL_ID)});
if (!${PRIVATE.toString()}.test(window.location.pathname)) fbq('track', 'PageView');`}
    </Script>
  )
}
