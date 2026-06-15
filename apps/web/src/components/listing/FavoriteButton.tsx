'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Heart, Loader2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { normalizeApiUrl } from '@/lib/utils/api-url'
import { track } from '@/lib/analytics'

/**
 * Save / unsave a listing to the user's portal "Saved Properties".
 * Guests are sent to sign-in. Uses the atomic toggle endpoint.
 */
export function FavoriteButton({ listingId, className = '' }: { listingId: string; className?: string }) {
  const { user } = useAuth()
  const router = useRouter()
  const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
  const [fav, setFav] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!user) { setFav(false); return }
    fetch(`${apiUrl}/api/favorites/check/${listingId}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j && typeof j.isFavorited === 'boolean') setFav(j.isFavorited) })
      .catch(() => {})
  }, [user, listingId, apiUrl])

  async function toggle() {
    if (!user) { router.push('/get-started'); return }
    if (busy) return
    setBusy(true)
    try {
      const res = await fetch(`${apiUrl}/api/favorites/${listingId}/toggle`, { method: 'POST', credentials: 'include' })
      const j = await res.json().catch(() => ({}))
      const next = (j?.data?.isFavorited ?? !fav) as boolean
      setFav(next)
      if (next) track('favorite', { listingId })
    } catch {
      // ignore — best effort
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={fav}
      className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors disabled:opacity-60 ${
        fav
          ? 'border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100'
          : 'border-slate-300 text-slate-700 hover:bg-slate-50'
      } ${className}`}
    >
      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Heart className={`w-4 h-4 ${fav ? 'fill-rose-500 text-rose-500' : ''}`} />}
      {fav ? 'Saved' : 'Save property'}
    </button>
  )
}
