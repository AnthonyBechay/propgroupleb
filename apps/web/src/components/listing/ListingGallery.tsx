'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight, Home, Play, X } from 'lucide-react'
import { normalizeFileUrl } from '@/lib/utils/api-url'

/**
 * A property's photos, with its video one clear tap away.
 *
 * Two problems with the galleries this replaced:
 *
 * 1. The video was the LAST slide of the carousel. Hardly anyone pages through
 *    twenty photos, so hardly anyone found it. It is now a "Watch video" button
 *    on the main photo that opens a large player over the page.
 *
 * 2. Changing photo felt slow. Only the current photo was ever in the page, so
 *    every click swapped in a brand-new image that then had to be downloaded
 *    and resized from nothing while the frame went blank. Now the photo either
 *    side of the current one — and every photo already seen — stays mounted,
 *    stacked and invisible, and changing photo is a 150 ms fade between images
 *    that are already there. Hovering a thumbnail starts loading its photo too.
 *
 * The same file lives in both storefront repos (propgroup and propgroupleb).
 */

interface GalleryProps {
  images: string[]
  title: string
  /** The property's video (YouTube link or video file). */
  videoUrl?: string | null
  /** More YouTube links, if the property has several. */
  videoUrls?: string[] | null
}

function youTubeId(raw: string): string | null {
  if (!raw) return null
  let url = raw.trim()
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\.|^m\./, '')
    if (host !== 'youtube.com' && host !== 'youtu.be') return null
    if (host === 'youtu.be') return u.pathname.split('/').filter(Boolean)[0] || null
    const v = u.searchParams.get('v')
    if (v) return v
    const parts = u.pathname.split('/').filter(Boolean) // embed/ID, shorts/ID, live/ID
    const idx = parts.findIndex((p) => ['embed', 'shorts', 'live', 'v'].includes(p))
    return idx >= 0 && parts[idx + 1] ? parts[idx + 1] : null
  } catch {
    return null
  }
}

const isVideoFile = (url: string) => /\.(mp4|webm|mov|m4v|ogg)(\?|$)/i.test(url)

export function MediaGallery({ images: rawImages, title, videoUrl, videoUrls }: GalleryProps) {
  const images = rawImages.map((u) => normalizeFileUrl(u)).filter(Boolean)
  const videos = [...new Set([videoUrl, ...(videoUrls ?? [])].filter((v): v is string => Boolean(v && v.trim())))]
  const total = images.length

  const [index, setIndex] = useState(0)
  // Photos kept in the page: the current one, its neighbours, and any seen.
  const [mounted, setMounted] = useState<Set<number>>(() => new Set([0, 1, total - 1].filter((i) => i >= 0 && i < total)))
  const [playing, setPlaying] = useState<number | null>(null)

  const keep = useCallback((...ids: number[]) => {
    setMounted((prev) => {
      const missing = ids.filter((i) => i >= 0 && i < total && !prev.has(i))
      if (!missing.length) return prev
      const next = new Set(prev)
      missing.forEach((i) => next.add(i))
      return next
    })
  }, [total])

  const go = useCallback((i: number) => {
    if (!total) return
    const n = (i + total) % total
    keep(n, (n + 1) % total, (n - 1 + total) % total)
    setIndex(n)
  }, [total, keep])

  const touchX = useRef<number | null>(null)

  // The player: Esc closes it, and the page behind it holds still.
  useEffect(() => {
    if (playing === null) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPlaying(null) }
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = previous }
  }, [playing])

  const watchButton = videos.length > 0 && (
    <button
      type="button"
      onClick={() => setPlaying(0)}
      className="absolute bottom-3 left-3 z-20 inline-flex min-h-11 items-center gap-2 rounded-full bg-white/95 py-1.5 pl-1.5 pr-4 text-sm font-semibold text-slate-900 shadow-lg ring-1 ring-black/5 transition hover:bg-white hover:scale-[1.02]"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-600 text-white">
        <Play className="h-4 w-4 translate-x-[1px] fill-white" />
      </span>
      Watch video{videos.length > 1 ? `s (${videos.length})` : ''}
    </button>
  )

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div
        className="group relative w-full aspect-[16/9] bg-slate-100 select-none outline-none"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') { e.preventDefault(); go(index + 1) }
          else if (e.key === 'ArrowLeft') { e.preventDefault(); go(index - 1) }
        }}
        onTouchStart={(e) => { touchX.current = e.touches[0].clientX }}
        onTouchEnd={(e) => {
          if (touchX.current == null) return
          const dx = e.changedTouches[0].clientX - touchX.current
          if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1))
          touchX.current = null
        }}
        aria-roledescription="carousel"
      >
        {total === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Home className="h-16 w-16 text-slate-300" />
          </div>
        ) : (
          images.map((src, i) =>
            mounted.has(i) ? (
              <Image
                key={src + i}
                src={src}
                alt={`${title} — photo ${i + 1}`}
                fill
                sizes="(max-width: 1024px) 100vw, 66vw"
                quality={75}
                priority={i === 0}
                // Neighbours load now, not when they become visible.
                loading={i === 0 ? undefined : 'eager'}
                className={`object-cover transition-opacity duration-150 ${i === index ? 'opacity-100' : 'opacity-0'}`}
                aria-hidden={i !== index}
              />
            ) : null,
          )
        )}

        {total > 1 && (
          <>
            <button type="button" onClick={() => go(index - 1)} aria-label="Previous photo"
              className="absolute left-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white opacity-0 transition-opacity hover:bg-black/65 focus:opacity-100 group-hover:opacity-100 max-md:opacity-100">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button type="button" onClick={() => go(index + 1)} aria-label="Next photo"
              className="absolute right-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white opacity-0 transition-opacity hover:bg-black/65 focus:opacity-100 group-hover:opacity-100 max-md:opacity-100">
              <ChevronRight className="h-5 w-5" />
            </button>
            <span className="absolute bottom-3 right-3 z-10 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
              {index + 1} / {total}
            </span>
          </>
        )}

        {watchButton}
      </div>

      {(total > 1 || videos.length > 0) && (
        <div className="flex gap-2 overflow-x-auto p-3">
          {/* The video leads the strip too — never last. */}
          {videos.length > 0 && (
            <button type="button" onClick={() => setPlaying(0)} aria-label="Watch the property video"
              className="relative flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-900 text-white">
              {youTubeId(videos[0]) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`https://i.ytimg.com/vi/${youTubeId(videos[0])}/mqdefault.jpg`} alt="" className="absolute inset-0 h-full w-full object-cover opacity-70" />
              )}
              <span className="relative flex h-7 w-7 items-center justify-center rounded-full bg-red-600">
                <Play className="h-3.5 w-3.5 translate-x-[1px] fill-white" />
              </span>
            </button>
          )}
          {total > 1 && images.map((src, i) => (
            <button
              key={src + i}
              type="button"
              onClick={() => go(i)}
              onMouseEnter={() => keep(i)}
              onFocus={() => keep(i)}
              aria-label={`Photo ${i + 1}`}
              aria-current={i === index}
              className={`relative h-14 w-20 shrink-0 overflow-hidden rounded-lg transition-all ${i === index ? 'ring-2 ring-slate-800 ring-offset-1' : 'opacity-70 hover:opacity-100'}`}
            >
              <Image src={src} alt="" fill sizes="80px" quality={50} className="object-cover" />
            </button>
          ))}
        </div>
      )}

      {playing !== null && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 p-3 sm:p-8" onClick={() => setPlaying(null)} role="dialog" aria-label={`${title} — video`}>
          <div className="relative w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => setPlaying(null)} aria-label="Close video"
              className="absolute -top-12 right-0 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25">
              <X className="h-5 w-5" />
            </button>
            <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
              {(() => {
                const url = videos[playing]
                const id = youTubeId(url)
                if (id) {
                  return (
                    <iframe
                      src={`https://www.youtube.com/embed/${id}?autoplay=1&rel=0`}
                      title={`${title} — video`}
                      className="absolute inset-0 h-full w-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  )
                }
                if (isVideoFile(url)) {
                  // eslint-disable-next-line jsx-a11y/media-has-caption
                  return <video src={normalizeFileUrl(url)} controls autoPlay playsInline className="absolute inset-0 h-full w-full object-contain" />
                }
                return (
                  <a href={url} target="_blank" rel="noopener noreferrer" className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white">
                    <Play className="h-12 w-12 fill-white" />
                    <span className="text-sm underline">Open the video</span>
                  </a>
                )
              })()}
            </div>
            {videos.length > 1 && (
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                {videos.map((_, i) => (
                  <button key={i} type="button" onClick={() => setPlaying(i)}
                    className={`min-h-9 rounded-full px-3 text-sm font-medium ${i === playing ? 'bg-white text-slate-900' : 'bg-white/15 text-white hover:bg-white/25'}`}>
                    Video {i + 1}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/** The Lebanon listing page's name for it. */
export const ListingGallery = MediaGallery
/** The Georgia project page's name for it. */
export const PropertyImageGallery = MediaGallery
