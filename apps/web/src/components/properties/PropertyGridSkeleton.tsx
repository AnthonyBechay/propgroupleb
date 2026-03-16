'use client'

export function PropertyGridSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      {[...Array(6)].map((_, index) => (
        <div
          key={index}
          className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm animate-pulse"
        >
          {/* Image skeleton */}
          <div className="aspect-[4/3] bg-stone-200" />

          {/* Content skeleton */}
          <div className="p-6 space-y-4">
            {/* Title */}
            <div className="space-y-2">
              <div className="h-6 bg-stone-200 rounded-lg w-3/4" />
              <div className="h-4 bg-stone-200 rounded-lg w-1/2" />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <div className="h-3 bg-stone-200 rounded-lg w-full" />
              <div className="h-3 bg-stone-200 rounded-lg w-4/5" />
            </div>

            {/* Features */}
            <div className="flex gap-4">
              <div className="h-8 bg-stone-100 rounded-lg w-16" />
              <div className="h-8 bg-stone-100 rounded-lg w-16" />
              <div className="h-8 bg-stone-100 rounded-lg w-20" />
            </div>

            {/* Price and buttons */}
            <div className="pt-4 border-t border-stone-200">
              <div className="flex items-end justify-between mb-4">
                <div className="h-8 bg-stone-200 rounded-lg w-32" />
                <div className="h-4 bg-stone-200 rounded-lg w-20" />
              </div>
              <div className="flex gap-3">
                <div className="h-10 bg-stone-200 rounded-lg flex-1" />
                <div className="h-10 bg-stone-200 rounded-lg flex-1" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
