/**
 * Admin skeleton — shown during route transitions inside /admin/*.
 *
 * Most admin pages are tables (properties, users, inquiries, contacts,
 * documents), so the skeleton models that: header + filter row + table
 * with rows. Pages that aren't tables (settings, content) still get a
 * roughly-correct shape; the alternative is a centred spinner that
 * jolts when the real layout pops in.
 */
export default function AdminLoading() {
  return (
    <div className="p-4 sm:p-6">
      {/* Header row */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div className="space-y-2 flex-1">
          <div className="h-7 w-44 bg-slate-100 rounded animate-pulse" />
          <div className="h-4 w-72 bg-slate-100 rounded animate-pulse" />
        </div>
        <div className="h-10 w-32 bg-[#1B3A5C]/30 rounded-lg animate-pulse shrink-0" />
      </div>

      {/* Filter / search row */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="h-9 w-64 bg-slate-100 rounded-lg animate-pulse" />
        <div className="h-9 w-32 bg-slate-100 rounded-lg animate-pulse" />
        <div className="h-9 w-32 bg-slate-100 rounded-lg animate-pulse" />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Table header row */}
        <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 grid grid-cols-12 gap-3">
          <div className="col-span-4 h-3 bg-slate-200 rounded animate-pulse" />
          <div className="col-span-2 h-3 bg-slate-200 rounded animate-pulse" />
          <div className="col-span-2 h-3 bg-slate-200 rounded animate-pulse" />
          <div className="col-span-2 h-3 bg-slate-200 rounded animate-pulse" />
          <div className="col-span-2 h-3 bg-slate-200 rounded animate-pulse" />
        </div>
        {/* Table body rows */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="px-4 py-4 grid grid-cols-12 gap-3 items-center border-b border-slate-100 last:border-0"
          >
            <div className="col-span-4 flex items-center gap-3">
              <div className="w-9 h-9 bg-slate-100 rounded-lg animate-pulse shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-3/4 bg-slate-100 rounded animate-pulse" />
                <div className="h-2.5 w-1/2 bg-slate-100 rounded animate-pulse" />
              </div>
            </div>
            <div className="col-span-2 h-3 bg-slate-100 rounded animate-pulse" />
            <div className="col-span-2 h-3 bg-slate-100 rounded animate-pulse" />
            <div className="col-span-2 h-3 bg-slate-100 rounded animate-pulse" />
            <div className="col-span-2 h-3 w-16 bg-slate-100 rounded-full animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  )
}
