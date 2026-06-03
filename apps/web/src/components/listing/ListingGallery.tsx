'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { Home, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { normalizeFileUrl } from '@/lib/utils/api-url'

interface ListingGalleryProps {
  images: string[]
  title: string
}

/**
 * Photo gallery for the public listing detail page.
 *
 * - Shows a large cover image plus a thumbnail strip.
 * - Clicking any photo (cover or thumbnail) opens a fullscreen lightbox where
 *   the visitor can step through every photo one by one — arrows on screen,
 *   ← / → keyboard keys, Esc or backdrop click to close, with a "n / total"
 *   counter.
 */
export function ListingGallery({ images, title }: ListingGalleryProps) {
  const urls = images.map((u) => normalizeFileUrl(u)).filter(Boolean)
  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(0)

  const total = urls.length
  const show = useCallback((i: number) => { setIndex(i); setOpen(true) }, [])
  const close = useCallback(() => setOpen(false), [])
  const next = useCallback(() => setIndex((i) => (i + 1) % total), [total])
  const prev = useCallback(() => setIndex((i) => (i - 1 + total) % total), [total])

  // Keyboard navigation + lock body scroll while the lightbox is open
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      else if (e.key === 'ArrowRight') next()
      else if (e.key === 'ArrowLeft') prev()
    }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open, close, next, prev])

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
    <>
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {/* Cover */}
        <button
          type="button"
          onClick={() => show(0)}
          className="relative block w-full aspect-[16/9] group"
          aria-label="Open photo gallery"
        >
          <Image
            src={urls[0]}
            alt={title}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            sizes="(max-width: 1024px) 100vw, 66vw"
            quality={80}
            priority
          />
          {total > 1 && (
            <span className="absolute bottom-3 right-3 px-2.5 py-1 rounded-full bg-black/60 text-white text-xs font-medium backdrop-blur-sm">
              1 / {total}
            </span>
          )}
        </button>

        {/* Thumbnails */}
        {total > 1 && (
          <div className="flex gap-2 p-3 overflow-x-auto">
            {urls.slice(1, 6).map((img, i) => (
              <button
                key={i}
                type="button"
                onClick={() => show(i + 1)}
                className="relative w-20 h-14 shrink-0 rounded-lg overflow-hidden ring-offset-1 hover:ring-2 hover:ring-slate-400 transition-all"
                aria-label={`View photo ${i + 2}`}
              >
                <Image src={img} alt={`Photo ${i + 2}`} fill className="object-cover" sizes="80px" quality={60} />
              </button>
            ))}
            {total > 6 && (
              <button
                type="button"
                onClick={() => show(6)}
                className="flex items-center justify-center w-20 h-14 shrink-0 rounded-lg bg-slate-100 text-slate-600 text-xs font-medium hover:bg-slate-200 transition-colors"
              >
                +{total - 6} more
              </button>
            )}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {open && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center"
          onClick={close}
          role="dialog"
          aria-modal="true"
        >
          {/* Close */}
          <button
            type="button"
            onClick={close}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
            aria-label="Close gallery"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Counter */}
          <span className="absolute top-5 left-1/2 -translate-x-1/2 text-white/80 text-sm font-medium">
            {index + 1} / {total}
          </span>

          {/* Prev */}
          {total > 1 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); prev() }}
              className="absolute left-3 sm:left-6 p-2 sm:p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
              aria-label="Previous photo"
            >
              <ChevronLeft className="w-6 h-6 sm:w-8 sm:h-8" />
            </button>
          )}

          {/* Image (stop propagation so clicking the photo doesn't close) */}
          <div
            className="relative w-[92vw] h-[82vh] max-w-6xl"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={urls[index]}
              alt={`${title} — photo ${index + 1}`}
              fill
              className="object-contain"
              sizes="92vw"
              quality={85}
              priority
            />
          </div>

          {/* Next */}
          {total > 1 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); next() }}
              className="absolute right-3 sm:right-6 p-2 sm:p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
              aria-label="Next photo"
            >
              <ChevronRight className="w-6 h-6 sm:w-8 sm:h-8" />
            </button>
          )}
        </div>
      )}
    </>
  )
}
