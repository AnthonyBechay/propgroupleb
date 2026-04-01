'use client'

import { useState } from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight, ImageIcon } from 'lucide-react'
import { normalizeFileUrl } from '@/lib/utils/api-url'

interface PropertyImageGalleryProps {
  images: string[]
  title: string
}

export function PropertyImageGallery({ images: rawImages, title }: PropertyImageGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  // Normalize R2 public URLs to use the backend proxy
  const images = rawImages.map(normalizeFileUrl)

  if (!images || images.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
        <div className="aspect-[16/10] bg-stone-100 flex flex-col items-center justify-center text-stone-400">
          <ImageIcon className="w-12 h-12 mb-2" />
          <span className="text-sm">No images available</span>
        </div>
      </div>
    )
  }

  const goTo = (index: number) => {
    if (index < 0) setActiveIndex(images.length - 1)
    else if (index >= images.length) setActiveIndex(0)
    else setActiveIndex(index)
  }

  return (
    <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
      {/* Main Image */}
      <div className="relative aspect-[16/10] bg-stone-100 group">
        <Image
          src={images[activeIndex]}
          alt={`${title} - Image ${activeIndex + 1}`}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 66vw"
          priority={activeIndex === 0}
        />

        {/* Navigation Arrows */}
        {images.length > 1 && (
          <>
            <button
              onClick={() => goTo(activeIndex - 1)}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 hover:bg-white flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Previous image"
            >
              <ChevronLeft className="w-5 h-5 text-stone-700" />
            </button>
            <button
              onClick={() => goTo(activeIndex + 1)}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 hover:bg-white flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Next image"
            >
              <ChevronRight className="w-5 h-5 text-stone-700" />
            </button>
          </>
        )}

        {/* Image Counter */}
        {images.length > 1 && (
          <div className="absolute bottom-3 right-3 px-3 py-1.5 rounded-full bg-black/50 text-white text-xs font-medium">
            {activeIndex + 1} / {images.length}
          </div>
        )}
      </div>

      {/* Thumbnail Strip */}
      {images.length > 1 && (
        <div className="p-3 border-t border-stone-100">
          <div className="flex gap-2 overflow-x-auto">
            {images.map((img, i) => (
              <button
                key={i}
                onClick={() => setActiveIndex(i)}
                className={`relative flex-shrink-0 w-20 h-14 rounded-lg overflow-hidden transition-all ${
                  i === activeIndex
                    ? 'ring-2 ring-[#1B4965] opacity-100'
                    : 'opacity-60 hover:opacity-100'
                }`}
              >
                <Image
                  src={img}
                  alt={`${title} thumbnail ${i + 1}`}
                  fill
                  className="object-cover"
                  sizes="80px"
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
