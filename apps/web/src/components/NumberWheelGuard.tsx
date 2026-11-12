'use client'

import { useEffect } from 'react'

/**
 * Stop the mouse wheel from changing numbers.
 *
 * A browser's number field steps its value when you scroll over it while it
 * has focus. So typing a budget of 5000 and then scrolling down the form — with
 * the pointer still resting on the field — saved 4999, and nobody saw it
 * happen. Commission rates, prices and areas were all exposed to it.
 *
 * Letting go of the field the moment a wheel turns over it leaves the number
 * as typed and lets the page scroll, which is what the person meant. One
 * listener for the whole app, so a number field added later is covered too.
 */
export function NumberWheelGuard() {
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      const el = document.activeElement
      if (el instanceof HTMLInputElement && el.type === 'number' && (e.target === el || el.contains(e.target as Node))) {
        el.blur()
      }
    }
    document.addEventListener('wheel', onWheel, { passive: true })
    return () => document.removeEventListener('wheel', onWheel)
  }, [])
  return null
}
