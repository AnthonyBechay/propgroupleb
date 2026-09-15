'use client'

/**
 * Guard against walking away from a half-filled form.
 *
 * The property form is nine sections long and the back office is used from a
 * phone, where the browser's back gesture is one swipe from the edge. Losing
 * twenty minutes of typing to it is the single most expensive thing this admin
 * could do, and nothing stood in the way.
 *
 * Two hooks, because a browser gives you two separate escape routes and neither
 * covers the other:
 *  - `useBeforeUnload` — closing the tab, reloading, typing a new URL. The
 *    browser shows its own dialog; the message is not ours to choose.
 *  - `useNavigationGuard` — clicking a link inside the app. Next's client
 *    router never hits `beforeunload`, so this intercepts the click itself.
 */

import { useEffect } from 'react'

/** Warn on tab close / reload while `when` is true. */
export function useBeforeUnload(when: boolean) {
  useEffect(() => {
    if (!when) return
    function handler(e: BeforeUnloadEvent) {
      e.preventDefault()
      // Chrome requires a returnValue to be set; the string is ignored.
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [when])
}

/**
 * Intercept in-app link clicks while `when` is true.
 *
 * Listens in the capture phase on the document rather than wrapping every
 * `<Link>`: the links that lose work are the ones nobody remembers to wrap —
 * the sidebar, the breadcrumb, the "All listings" shortcut in a page header.
 */
export function useNavigationGuard(when: boolean, message: string) {
  useEffect(() => {
    if (!when) return

    function onClick(e: MouseEvent) {
      // Let the browser handle modified clicks — they open a new tab and leave
      // this form exactly where it is.
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return

      const anchor = (e.target as HTMLElement | null)?.closest?.('a')
      if (!anchor) return

      const href = anchor.getAttribute('href')
      if (!href || href.startsWith('#')) return
      if (anchor.target && anchor.target !== '_self') return
      // Same page — no navigation, nothing to lose.
      if (href === window.location.pathname + window.location.search) return

      // eslint-disable-next-line no-alert
      if (!window.confirm(message)) {
        e.preventDefault()
        e.stopPropagation()
      }
    }

    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [when, message])
}

/** Both guards at once — what a form actually wants. */
export function useUnsavedChanges(
  dirty: boolean,
  message = 'You have unsaved changes. Leave this page and lose them?',
) {
  useBeforeUnload(dirty)
  useNavigationGuard(dirty, message)
}
