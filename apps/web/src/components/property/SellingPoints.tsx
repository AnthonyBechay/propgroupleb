/**
 * A property's selling points as the public sees them. A point can carry a
 * detail, stored as "Point — detail" (the back office's selling-points editor
 * writes it that way): the point reads bold, the detail beside it.
 *
 * The same file lives in both storefront repos (propgroup and propgroupleb).
 */
const SEPARATOR = ' — '

export function splitSellingPoint(s: string): { point: string; detail: string } {
  const i = s.indexOf(SEPARATOR)
  return i === -1 ? { point: s.trim(), detail: '' } : { point: s.slice(0, i).trim(), detail: s.slice(i + SEPARATOR.length).trim() }
}

export function SellingPoints({ points, title = 'Highlights' }: { points: string[]; title?: string }) {
  const rows = points.map(splitSellingPoint).filter((r) => r.point)
  if (rows.length === 0) return null
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6">
      <h2 className="text-lg font-semibold text-slate-900 mb-3">{title}</h2>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
        {rows.map((r, i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm text-slate-700">
            <span className="mt-[0.45rem] h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" aria-hidden />
            <span>
              <span className="font-medium text-slate-900">{r.point}</span>
              {r.detail && <span className="text-slate-600"> — {r.detail}</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
