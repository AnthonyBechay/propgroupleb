/**
 * Skeleton for the property detail page.
 *
 * This is the page first-time visitors hit from Google / social shares,
 * so the perceived-wait cost is highest here. Without `loading.tsx`,
 * App Router shows a blank screen during SSR (Prisma fetch + RSC render
 * can take 200–600 ms even on a fast container, longer if `next/image`
 * is generating cold variants).
 *
 * Skeleton mirrors the actual page layout: hero gallery, sticky sidebar
 * card on desktop, content blocks underneath. Uses `pg-`-tone neutrals
 * matching the design system so the transition into the real page is
 * visually smooth.
 */
export default function PropertyLoading() {
  return (
    <div className="min-h-screen bg-white">
      {/* Breadcrumb skeleton */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <div className="h-3 w-64 bg-slate-100 rounded animate-pulse" />
      </div>

      {/* Title row */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-2">
        <div className="h-8 sm:h-10 w-3/4 max-w-xl bg-slate-100 rounded animate-pulse mb-3" />
        <div className="h-4 w-1/2 max-w-md bg-slate-100 rounded animate-pulse" />
      </div>

      {/* Two-column: gallery + sidebar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Gallery (2/3 on desktop) */}
          <div className="lg:col-span-2 space-y-3">
            <div className="aspect-[4/3] bg-slate-100 rounded-2xl animate-pulse" />
            <div className="grid grid-cols-4 gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-square bg-slate-100 rounded-lg animate-pulse"
                />
              ))}
            </div>
          </div>

          {/* Sidebar (1/3 on desktop) — sticky-style card */}
          <aside className="space-y-4">
            <div className="bg-slate-50 rounded-2xl p-5 space-y-4 border border-slate-200">
              <div className="h-9 w-32 bg-slate-200 rounded animate-pulse" />
              <div className="h-4 w-24 bg-slate-200 rounded animate-pulse" />
              <div className="border-t border-slate-200 pt-4 space-y-2">
                <div className="h-3 w-full bg-slate-200 rounded animate-pulse" />
                <div className="h-3 w-5/6 bg-slate-200 rounded animate-pulse" />
                <div className="h-3 w-4/6 bg-slate-200 rounded animate-pulse" />
              </div>
              <div className="h-11 w-full bg-[#1B3A5C]/30 rounded-lg animate-pulse" />
              <div className="h-9 w-full bg-slate-200 rounded-lg animate-pulse" />
            </div>
          </aside>
        </div>

        {/* Content blocks under the gallery */}
        <div className="mt-10 space-y-6">
          {/* Description */}
          <div className="space-y-2 max-w-3xl">
            <div className="h-5 w-40 bg-slate-100 rounded animate-pulse mb-3" />
            <div className="h-3 w-full bg-slate-100 rounded animate-pulse" />
            <div className="h-3 w-11/12 bg-slate-100 rounded animate-pulse" />
            <div className="h-3 w-10/12 bg-slate-100 rounded animate-pulse" />
            <div className="h-3 w-9/12 bg-slate-100 rounded animate-pulse" />
          </div>

          {/* Stat band */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="bg-slate-50 rounded-xl p-4 border border-slate-200"
              >
                <div className="h-3 w-16 bg-slate-200 rounded animate-pulse mb-2" />
                <div className="h-6 w-20 bg-slate-200 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
