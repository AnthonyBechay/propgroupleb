import { normalizeApiUrl } from '@/lib/utils/api-url'

/**
 * What went wrong on a phone, written to the backend's log. The installed Inbox
 * app has no address bar and no console, so a crash there leaves nothing to go
 * on but "it went white". Back office only; never the content of a chat.
 */

let sent = 0
const MAX_PER_PAGE_LOAD = 5

const installed = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true)

export function reportProblem(kind: string, message: string, stack?: string): void {
  if (typeof window === 'undefined' || !window.location.pathname.startsWith('/admin')) return
  if (sent >= MAX_PER_PAGE_LOAD) return
  sent += 1
  const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
  fetch(`${apiUrl}/api/crm/inbox/client-problem`, {
    method: 'POST',
    credentials: 'include',
    keepalive: true,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      kind,
      message: message.slice(0, 300),
      stack: stack?.slice(0, 600),
      // The path only: ?c= says which chat, and nothing else belongs in a log.
      path: `${window.location.pathname}${window.location.search}`.slice(0, 120),
      installed: installed(),
      userAgent: navigator.userAgent.slice(0, 200),
    }),
  }).catch(() => {})
}

/** A phone losing signal for a moment is not a bug. */
const isNetworkBlip = (message: string) => /load failed|failed to fetch|networkerror|network request failed/i.test(message)

/** Report what breaks while the Inbox is open, and a reload nobody asked for. Returns the cleanup. */
export function watchForProblems(): () => void {
  // The installed app has no reload button, so a reload there is iOS restarting
  // a page it ran out of memory for, which is what "it went white" looks like.
  const navigation = performance.getEntriesByType?.('navigation')[0] as PerformanceNavigationTiming | undefined
  if (installed() && navigation?.type === 'reload') reportProblem('restarted', 'The installed app was reloaded without anyone asking.')

  const onError = (e: ErrorEvent) => {
    if (!isNetworkBlip(e.message)) reportProblem('error', e.message, e.error?.stack)
  }
  const onRejection = (e: PromiseRejectionEvent) => {
    const message = String(e.reason?.message ?? e.reason)
    if (!isNetworkBlip(message)) reportProblem('rejection', message, e.reason?.stack)
  }
  window.addEventListener('error', onError)
  window.addEventListener('unhandledrejection', onRejection)
  return () => {
    window.removeEventListener('error', onError)
    window.removeEventListener('unhandledrejection', onRejection)
  }
}

/**
 * An app left open across a deploy still asks for the old build's files, which
 * are gone. Trying again cannot help; loading the new build does. Returns true
 * when it is reloading. Once a minute at most, so a real fault cannot loop.
 */
export function reloadIfBuildChanged(error: Error): boolean {
  if (!/ChunkLoadError|Loading (CSS )?chunk|dynamically imported module|Importing a module script failed/i.test(`${error.name} ${error.message}`)) return false
  try {
    const last = Number(sessionStorage.getItem('reloadedForNewBuild') ?? 0)
    if (Date.now() - last < 60_000) return false
    sessionStorage.setItem('reloadedForNewBuild', String(Date.now()))
  } catch {
    return false
  }
  window.location.reload()
  return true
}
