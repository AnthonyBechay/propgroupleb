'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { Home, ChevronLeft, ChevronRight } from 'lucide-react'
import { normalizeFileUrl } from '@/lib/utils/api-url'

interface ListingGalleryProps {
  images: string[]
  title: string
}

/**
 * Inline photo carousel for the public listing detail page.
 *
 * The main photo frame IS the carousel — arrows and the thumbnail strip change
 * the displayed image in place (no popup). Every image is shown in a fixed
 * 16:9 frame with object-cover, so regardless of the original photo dimensions
 * it always fills its place cleanly and the layout never jumps.
 */
export function ListingGallery({ images, title }: ListingGalleryProps) {
  const urls = images.map((u) => normalizeFileUrl(u)).filter(Boolean)
  const [index, setIndex] = useState(0)
  const total = urls.length

  const go = (i: number) => setIndex((i + total) % total)
  const next = () => go(index + 1)
  const prev = () => go(index - 1)

  // Touch swipe (mobile)
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

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      {/* Main frame — fixed 16:9, image always fills it */}
      <div
        className="relative w-full aspect-[16/9] bg-slate-100 select-none outline-none focus:outline-none group"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') { e.preventDefault(); next() }
          else if (e.key === 'ArrowLeft') { e.preventDefault(); prev() }
        }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        aria-roledescription="carousel"
      >
        <Image
          src={urls[index]}
          alt={`${title} — photo ${index + 1}`}
          fill
          className="object-cover"
          sizes="(max-width: 1024px) 100vw, 66vw"
          quality={80}
          priority={index === 0}
        />

        {total > 1 && (
          <>
            <button
              type="button"
              onClick={prev}
              className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
              aria-label="Previous photo"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={next}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
              aria-label="Next photo"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <span className="absolute bottom-3 right-3 px-2.5 py-1 rounded-full bg-black/60 text-white text-xs font-medium backdrop-blur-sm">
              {index + 1} / {total}
            </span>
          </>
        )}
      </div>

      {/* Thumbnail strip — click to jump to that photo */}
      {total > 1 && (
        <div className="flex gap-2 p-3 overflow-x-auto">
          {urls.map((img, i) => (
            <button
              key={i}
              type="button"
              onClick={() => go(i)}
              className={`relative w-20 h-14 shrink-0 rounded-lg overflow-hidden transition-all ${
                i === index
                  ? 'ring-2 ring-slate-800 ring-offset-1'
                  : 'opacity-70 hover:opacity-100'
              }`}
              aria-label={`Go to photo ${i + 1}`}
              aria-current={i === index}
            >
              <Image src={img} alt={`Photo ${i + 1}`} fill className="object-cover" sizes="80px" quality={60} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
