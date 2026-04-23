'use client'

import { Play } from 'lucide-react'

/**
 * Extract a YouTube video ID from any common URL shape:
 *   https://www.youtube.com/watch?v=abc123
 *   https://youtu.be/abc123
 *   https://www.youtube.com/embed/abc123
 *   https://www.youtube.com/shorts/abc123
 * Returns null for non-YouTube URLs so we can skip them quietly.
 */
function extractYoutubeId(url: string): string | null {
  try {
    const u = new URL(url.trim())
    if (u.hostname.includes('youtu.be')) {
      return u.pathname.slice(1).split('/')[0] || null
    }
    if (u.hostname.includes('youtube.com')) {
      const v = u.searchParams.get('v')
      if (v) return v
      // /embed/<id> or /shorts/<id>
      const parts = u.pathname.split('/').filter(Boolean)
      const idx = parts.findIndex(p => p === 'embed' || p === 'shorts')
      if (idx >= 0 && parts[idx + 1]) return parts[idx + 1]
    }
  } catch {
    /* malformed URL — fall through */
  }
  return null
}

interface PropertyVideosProps {
  urls: string[]
}

export function PropertyVideos({ urls }: PropertyVideosProps) {
  const ids = urls
    .map(extractYoutubeId)
    .filter((id): id is string => !!id)

  if (ids.length === 0) return null

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
        <Play className="w-5 h-5 text-[#1B3A5C]" />
        Videos
      </h2>
      <div
        className={`grid gap-3 ${
          ids.length === 1 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'
        }`}
      >
        {ids.map((id) => (
          <div
            key={id}
            className="relative w-full overflow-hidden rounded-lg bg-slate-100"
            style={{ aspectRatio: '16 / 9', maxHeight: ids.length === 1 ? 360 : 260 }}
          >
            <iframe
              src={`https://www.youtube.com/embed/${id}?rel=0`}
              title="Property video"
              loading="lazy"
              allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 w-full h-full border-0"
            />
          </div>
        ))}
      </div>
    </div>
  )
}
