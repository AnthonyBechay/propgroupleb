'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { Home, ChevronLeft, ChevronRight, Play } from 'lucide-react'
import { normalizeFileUrl } from '@/lib/utils/api-url'

interface ListingGalleryProps {
  images: string[]
  title: string
  videoUrl?: string | null
}

type Slide = { type: 'image'; url: string } | { type: 'video'; url: string }

function youTubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/)
  return m ? m[1] : null
}

/**
 * Inline media carousel for the public listing detail page — photos plus an
 * optional property video shown as the last slide. Arrows / thumbnails / swipe
 * change the slide in place (no popup). Photos use a fixed 16:9 object-cover
 * frame so the layout never jumps.
 */
export function ListingGallery({ images, title, videoUrl }: ListingGalleryProps) {
  const slides: Slide[] = [
    ...images.map((u) => ({ type: 'image' as const, url: normalizeFileUrl(u) })).filter((s) => s.url),
    ...(videoUrl ? [{ type: 'video' as const, url: videoUrl }] : []),
  ]
  const [index, setIndex] = useState(0)
  const total = slides.length

  const go = (i: number) => setIndex((i + total) % total)
  const next = () => go(index + 1)
  const prev = () => go(index - 1)

  const touchX = useRef<number | null>(null)
  const onTouchStart = (e: React.TouchEvent) => { touchX.current = e.touches[0].clientX }
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchX.current == null) return
    const dx = e.changedTouches[0].clientX - touchX.current
    if (Math.abs(dx) > 40) (dx < 0 ? next : prev)()
    touchX.current = null
  }

  if (total === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="aspect-[16/9] flex items-center justify-center bg-slate-100">
          <Home className="w-16 h-16 text-slate-300" />
        </div>
      </div>
    )
  }

  const current = slides[index]

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      {/* Main frame */}
      <div
        className="relative w-full aspect-[16/9] bg-slate-900 select-none outline-none focus:outline-none group"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') { e.preventDefault(); next() }
          else if (e.key === 'ArrowLeft') { e.preventDefault(); prev() }
        }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        aria-roledescription="carousel"
      >
        {current.type === 'image' ? (
          <Image
            src={current.url}
            alt={`${title} — photo ${index + 1}`}
            fill
            className="object-cover"
            sizes="(max-width: 1024px) 100vw, 66vw"
            quality={80}
            priority={index === 0}
          />
        ) : youTubeId(current.url) ? (
          <iframe
            src={`https://www.youtube.com/embed/${youTubeId(current.url)}`}
            title={`${title} — video`}
            className="absolute inset-0 w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video src={normalizeFileUrl(current.url)} controls playsInline className="absolute inset-0 w-full h-full object-contain bg-black" />
        )}

        {total > 1 && (
          <>
            <button type="button" onClick={prev} className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 z-10" aria-label="Previous">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button type="button" onClick={next} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 z-10" aria-label="Next">
              <ChevronRight className="w-5 h-5" />
            </button>
            <span className="absolute bottom-3 right-3 px-2.5 py-1 rounded-full bg-black/60 text-white text-xs font-medium backdrop-blur-sm z-10">
              {index + 1} / {total}
            </span>
          </>
        )}
      </div>

      {/* Thumbnail strip */}
      {total > 1 && (
        <div className="flex gap-2 p-3 overflow-x-auto">
          {slides.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => go(i)}
              className={`relative w-20 h-14 shrink-0 rounded-lg overflow-hidden transition-all ${
                i === index ? 'ring-2 ring-slate-800 ring-offset-1' : 'opacity-70 hover:opacity-100'
              }`}
              aria-label={s.type === 'video' ? 'Property video' : `Photo ${i + 1}`}
              aria-current={i === index}
            >
              {s.type === 'image' ? (
                <Image src={s.url} alt={`Photo ${i + 1}`} fill className="object-cover" sizes="80px" quality={60} />
              ) : (
                <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                  <Play className="w-5 h-5 text-white fill-white" />
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
