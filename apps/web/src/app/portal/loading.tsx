/**
 * Portal skeleton — shown during route transitions inside /portal/*.
 *
 * Mirrors the dashboard's stat-card-grid + content-block layout so the
 * shape of the page is stable from skeleton to real render. Avoids the
 * "centred spinner" pattern which jolts the user when the real layout
 * pops in afterward.
 */
export default function PortalLoading() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Page header */}
      <div className="mb-6 space-y-2">
        <div className="h-7 w-48 bg-slate-100 rounded animate-pulse" />
        <div className="h-4 w-64 bg-slate-100 rounded animate-pulse" />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="bg-slate-50 rounded-xl p-5 border border-slate-200"
          >
            <div className="h-3 w-20 bg-slate-200 rounded animate-pulse mb-3" />
            <div className="h-8 w-24 bg-slate-200 rounded animate-pulse mb-2" />
            <div className="h-3 w-16 bg-slate-200 rounded animate-pulse" />
          </div>
        ))}
      </div>

      {/* Two-column content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          <div className="h-5 w-40 bg-slate-100 rounded animate-pulse mb-2" />
          <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-200 rounded-lg animate-pulse shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-2/3 bg-slate-200 rounded animate-pulse" />
                  <div className="h-3 w-1/3 bg-slate-200 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          <div className="h-5 w-32 bg-slate-100 rounded animate-pulse mb-2" />
          <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 space-y-2">
            <div className="h-3 w-full bg-slate-200 rounded animate-pulse" />
            <div className="h-3 w-5/6 bg-slate-200 rounded animate-pulse" />
            <div className="h-3 w-4/6 bg-slate-200 rounded animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  )
}
