/**
 * The admin installed on an iPhone's Home Screen. There, a swipe back over a
 * step the page added to the history shows WebKit's snapshot of the previous
 * step, and that snapshot is what stayed white and ignored every tap until the
 * app was closed. So in this app the inbox adds no history steps and closes a
 * chat with its own edge swipe instead.
 */
export function isIosHomeScreenApp(): boolean {
  if (typeof window === 'undefined') return false
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  return ios && standalone
}
