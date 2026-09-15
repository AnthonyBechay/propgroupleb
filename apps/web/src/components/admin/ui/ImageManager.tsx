'use client'

/**
 * One photo manager for the whole back office.
 *
 * There were three: the create form's, the edit form's, and the unit panel's.
 * They uploaded to the same endpoint and then disagreed about everything else —
 * only two could set a cover, only one showed a spinner while deleting, none
 * could reorder, and the unit one silently swallowed every upload failure so a
 * photo that never arrived looked exactly like one that did.
 *
 * What this adds beyond merging them:
 *  - **Drop files on it.** Dragging a folder of photos from Finder is how these
 *    actually arrive; clicking through a file picker one batch at a time is not.
 *  - **Real per-file progress.** Uploads go through XHR rather than `fetch`
 *    because `fetch` cannot report upload progress, and a phone on Lebanese
 *    mobile data pushing 4 MB of photos with no feedback looks frozen.
 *  - **Order is editable.** Order is what the public gallery renders, and the
 *    only control over it was "promote this one to first". Drag on desktop,
 *    arrows everywhere — touch has no HTML5 drag-and-drop.
 *  - **Failures are named.** Per-file errors with a retry, instead of a count.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertCircle, ArrowLeft, ArrowRight, GripVertical, ImageIcon, Loader2,
  RotateCw, Star, Trash2, X, ZoomIn,
} from 'lucide-react'
import { normalizeApiUrl, normalizeFileUrl } from '@/lib/utils/api-url'
import { cn } from '@/lib/utils'
import { ConfirmDialog } from './ConfirmDialog'

const ACCEPT = 'image/jpeg,image/png,image/webp,image/avif'
/** R2 upload limit on the backend; flagged here so it fails before the round trip. */
const MAX_BYTES = 15 * 1024 * 1024

interface PendingUpload {
  id: string
  name: string
  /** 0–100, from the XHR upload progress event. */
  progress: number
  error?: string
  file: File
}

function humanSize(bytes: number) {
  return bytes >= 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`
}

/**
 * Upload one file with progress.
 *
 * `credentials: 'include'` is the whole reason this can't be a plain fetch with
 * a progress wrapper — the auth cookie has to ride along, and XHR spells that
 * `withCredentials`.
 */
function uploadWithProgress(
  url: string,
  form: FormData,
  onProgress: (pct: number) => void,
): Promise<{ url?: string; error?: string }> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', url)
    xhr.withCredentials = true
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      let body: Record<string, unknown> = {}
      try { body = JSON.parse(xhr.responseText) } catch { /* non-JSON error page */ }
      if (xhr.status >= 200 && xhr.status < 300 && typeof body.url === 'string') {
        resolve({ url: body.url })
      } else {
        resolve({ error: (body.message as string) || (body.error as string) || `Upload failed (${xhr.status})` })
      }
    }
    xhr.onerror = () => resolve({ error: 'Network error' })
    xhr.onabort = () => resolve({ error: 'Cancelled' })
    xhr.send(form)
  })
}

export function ImageManager({
  value,
  onChange,
  folder = 'buildings',
  propertySlug,
  label = 'Photos',
  hint,
  /**
   * Remove the file from R2 as well as from the list.
   *
   * True while creating (the file is orphaned the moment you drop it from a
   * record that doesn't exist yet). False where the record already has them and
   * the change is only committed on save — otherwise "remove, then cancel"
   * destroys a live photo that the page still points at.
   */
  deleteFromStorage = true,
  max,
  disabled,
  className,
}: {
  value: string[]
  onChange: (next: string[]) => void
  folder?: string
  propertySlug?: string
  label?: string
  hint?: React.ReactNode
  deleteFromStorage?: boolean
  max?: number
  disabled?: boolean
  className?: string
}) {
  const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
  const inputRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<PendingUpload[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [lightbox, setLightbox] = useState<number | null>(null)
  const [confirmRemove, setConfirmRemove] = useState<number[] | null>(null)
  const [removing, setRemoving] = useState(false)

  // The list is addressed by index, so anything holding indices has to be
  // dropped when the list itself changes underneath it.
  const valueRef = useRef(value)
  valueRef.current = value

  const remaining = max != null ? Math.max(0, max - value.length) : Infinity

  // ── Upload ──────────────────────────────────────────────────────────────────

  const runUpload = useCallback(async (files: File[]) => {
    const accepted: File[] = []
    const rejected: PendingUpload[] = []

    for (const file of files) {
      const id = `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 8)}`
      if (!file.type.startsWith('image/')) {
        rejected.push({ id, name: file.name, progress: 0, error: 'Not an image', file })
      } else if (file.size > MAX_BYTES) {
        rejected.push({ id, name: file.name, progress: 0, error: `Too large (${humanSize(file.size)}, max 15 MB)`, file })
      } else {
        accepted.push(file)
      }
    }

    const queued: PendingUpload[] = accepted.map((file) => ({
      id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 8)}`,
      name: file.name,
      progress: 0,
      file,
    }))
    setPending((p) => [...p, ...queued, ...rejected])

    // Two at a time: enough to keep a fast connection busy, few enough that a
    // dozen photos on mobile data don't all crawl and time out together.
    const CONCURRENCY = 2
    let cursor = 0

    async function worker() {
      while (cursor < queued.length) {
        const item = queued[cursor++]
        const fd = new FormData()
        fd.append('file', item.file)
        fd.append('folder', folder)
        if (propertySlug?.trim()) fd.append('propertySlug', propertySlug.trim())

        const res = await uploadWithProgress(`${apiUrl}/api/upload`, fd, (pct) => {
          setPending((p) => p.map((x) => (x.id === item.id ? { ...x, progress: pct } : x)))
        })

        if (res.url) {
          // Append as each one lands rather than in one batch at the end, so a
          // long queue visibly fills the grid instead of sitting at 100%.
          //
          // The ref is advanced here, synchronously, and not left to the parent
          // re-render: two workers finish independently, and if the second read
          // `valueRef` before React had committed the first one's `onChange`,
          // it would build its array from the list without that photo in it and
          // the upload would vanish on its way into the grid.
          const next = [...valueRef.current, res.url]
          valueRef.current = next
          onChange(next)
          setPending((p) => p.filter((x) => x.id !== item.id))
        } else {
          setPending((p) => p.map((x) => (x.id === item.id ? { ...x, error: res.error, progress: 0 } : x)))
        }
      }
    }

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queued.length) }, worker))
  }, [apiUrl, folder, propertySlug, onChange])

  function pick(files: FileList | File[] | null) {
    if (!files || disabled) return
    let list = Array.from(files)
    if (remaining !== Infinity && list.length > remaining) list = list.slice(0, remaining)
    if (list.length) runUpload(list)
  }

  function retry(item: PendingUpload) {
    setPending((p) => p.filter((x) => x.id !== item.id))
    runUpload([item.file])
  }

  // ── Reorder ─────────────────────────────────────────────────────────────────

  function move(from: number, to: number) {
    if (from === to || to < 0 || to >= value.length) return
    const next = [...value]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    onChange(next)
    setSelected(new Set())
  }

  // ── Remove ──────────────────────────────────────────────────────────────────

  async function doRemove(indices: number[]) {
    setRemoving(true)
    const urls = indices.map((i) => value[i]).filter(Boolean)
    if (deleteFromStorage) {
      await Promise.all(urls.map((url) =>
        fetch(`${apiUrl}/api/upload`, {
          method: 'DELETE',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        }).catch(() => {
          // Already gone, or storage is unreachable. Either way the reference
          // still has to leave the form — keeping a URL that renders as a
          // broken image is worse than an orphaned object in the bucket.
        }),
      ))
    }
    const drop = new Set(indices)
    onChange(value.filter((_, i) => !drop.has(i)))
    setSelected(new Set())
    setConfirmRemove(null)
    setRemoving(false)
  }

  // ── Lightbox keyboard ───────────────────────────────────────────────────────

  useEffect(() => {
    if (lightbox == null) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setLightbox(null)
      if (e.key === 'ArrowRight') setLightbox((i) => (i == null ? i : Math.min(i + 1, valueRef.current.length - 1)))
      if (e.key === 'ArrowLeft') setLightbox((i) => (i == null ? i : Math.max(i - 1, 0)))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightbox])

  const selectedList = Array.from(selected).sort((a, b) => a - b)
  const atLimit = remaining === 0

  return (
    <div className={cn('space-y-3', className)}>
      {/* Header: count + bulk actions */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm">
          <span className="font-medium text-slate-700">{label}</span>
          <span className="ml-2 text-slate-400">
            {value.length === 0 ? 'none yet' : `${value.length}${max ? ` / ${max}` : ''}`}
            {pending.length > 0 && ` · ${pending.filter((p) => !p.error).length} uploading`}
          </span>
        </div>
        {selectedList.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500">{selectedList.length} selected</span>
            <button
              type="button"
              onClick={() => setConfirmRemove(selectedList)}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-red-50 px-2.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-100"
            >
              <Trash2 className="h-3.5 w-3.5" /> Remove
            </button>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="min-h-9 px-1 text-xs text-slate-400 hover:text-slate-700"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Grid */}
      {(value.length > 0 || pending.length > 0) && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {value.map((url, i) => {
            const isCover = i === 0
            const isSelected = selected.has(i)
            return (
              <li
                key={`${url}-${i}`}
                draggable={!disabled}
                onDragStart={(e) => {
                  setDragIndex(i)
                  e.dataTransfer.effectAllowed = 'move'
                  // Firefox refuses to start a drag without data on the transfer.
                  e.dataTransfer.setData('text/plain', String(i))
                }}
                onDragOver={(e) => { e.preventDefault(); setOverIndex(i) }}
                onDragEnd={() => { setDragIndex(null); setOverIndex(null) }}
                onDrop={(e) => {
                  e.preventDefault()
                  if (dragIndex != null) move(dragIndex, i)
                  setDragIndex(null); setOverIndex(null)
                }}
                className={cn(
                  'group relative aspect-[4/3] overflow-hidden rounded-lg border bg-slate-100 transition-all',
                  isSelected ? 'border-slate-800 ring-2 ring-slate-800/20' : 'border-slate-200',
                  dragIndex === i && 'opacity-40',
                  overIndex === i && dragIndex !== null && dragIndex !== i && 'ring-2 ring-sky-400',
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={normalizeFileUrl(url)}
                  alt={isCover ? 'Cover photo' : `Photo ${i + 1}`}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />

                {/* Select — always visible, because on touch there is no hover */}
                <button
                  type="button"
                  onClick={() => setSelected((s) => {
                    const n = new Set(s)
                    n.has(i) ? n.delete(i) : n.add(i)
                    return n
                  })}
                  aria-label={isSelected ? 'Deselect photo' : 'Select photo'}
                  aria-pressed={isSelected}
                  className={cn(
                    'absolute left-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-md border text-[10px] font-bold transition-colors',
                    isSelected
                      ? 'border-slate-800 bg-slate-800 text-white'
                      : 'border-white/70 bg-black/30 text-transparent hover:bg-black/50',
                  )}
                >
                  ✓
                </button>

                {isCover && (
                  <span className="absolute bottom-1.5 left-1.5 rounded bg-slate-900/90 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    Cover
                  </span>
                )}

                {!disabled && (
                  <span className="absolute right-1.5 top-1.5 hidden cursor-grab text-white/70 drop-shadow group-hover:block lg:block">
                    <GripVertical className="h-4 w-4" />
                  </span>
                )}

                {/* Action bar — visible on touch, revealed on hover on desktop */}
                <div
                  className={cn(
                    'absolute inset-x-0 bottom-0 flex items-center justify-end gap-0.5 bg-gradient-to-t from-black/70 to-transparent p-1.5',
                    'opacity-100 transition-opacity lg:opacity-0 lg:group-hover:opacity-100',
                  )}
                >
                  <IconAction label="Move left" onClick={() => move(i, i - 1)} disabled={disabled || i === 0}>
                    <ArrowLeft className="h-3.5 w-3.5" />
                  </IconAction>
                  <IconAction label="Move right" onClick={() => move(i, i + 1)} disabled={disabled || i === value.length - 1}>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </IconAction>
                  {!isCover && (
                    <IconAction label="Make cover" onClick={() => move(i, 0)} disabled={disabled}>
                      <Star className="h-3.5 w-3.5" />
                    </IconAction>
                  )}
                  <IconAction label="Preview" onClick={() => setLightbox(i)}>
                    <ZoomIn className="h-3.5 w-3.5" />
                  </IconAction>
                  <IconAction label="Remove" danger onClick={() => setConfirmRemove([i])} disabled={disabled}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </IconAction>
                </div>
              </li>
            )
          })}

          {/* In-flight uploads */}
          {pending.map((p) => (
            <li
              key={p.id}
              className={cn(
                'relative flex aspect-[4/3] flex-col items-center justify-center gap-1.5 rounded-lg border p-2 text-center',
                p.error ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-slate-50',
              )}
            >
              {p.error ? (
                <>
                  <AlertCircle className="h-5 w-5 text-red-500" />
                  <p className="w-full truncate text-[11px] font-medium text-red-700" title={p.name}>{p.name}</p>
                  <p className="text-[10px] text-red-600">{p.error}</p>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => retry(p)}
                      className="inline-flex items-center gap-1 rounded border border-red-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-red-700 hover:bg-red-50"
                    >
                      <RotateCw className="h-3 w-3" /> Retry
                    </button>
                    <button
                      type="button"
                      onClick={() => setPending((list) => list.filter((x) => x.id !== p.id))}
                      className="rounded px-1.5 py-0.5 text-[10px] text-red-500 hover:bg-red-100"
                    >
                      Dismiss
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                  <p className="w-full truncate text-[11px] text-slate-500" title={p.name}>{p.name}</p>
                  <div className="h-1 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-slate-700 transition-[width] duration-200"
                      style={{ width: `${p.progress}%` }}
                    />
                  </div>
                  <p className="text-[10px] tabular-nums text-slate-400">{p.progress}%</p>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Dropzone */}
      {!atLimit && (
        <div
          role="button"
          tabIndex={0}
          onClick={() => !disabled && inputRef.current?.click()}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click() } }}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            pick(e.dataTransfer.files)
          }}
          className={cn(
            'cursor-pointer rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors',
            dragOver ? 'border-slate-800 bg-slate-50' : 'border-slate-200 hover:border-slate-400',
            disabled && 'pointer-events-none opacity-50',
          )}
        >
          <ImageIcon className="mx-auto mb-2 h-7 w-7 text-slate-300" />
          <p className="text-sm text-slate-600">
            <span className="font-medium text-slate-800">Drop photos here</span> or click to choose
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {hint ?? <>JPG, PNG, WebP or AVIF · up to 15 MB each · the first photo is the cover — drag to reorder</>}
          </p>
        </div>
      )}
      {atLimit && (
        <p className="text-xs text-amber-600">Maximum of {max} photos reached. Remove one to add another.</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => { pick(e.target.files); e.target.value = '' }}
      />

      {/* Lightbox */}
      {lightbox != null && value[lightbox] && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Photo preview"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={normalizeFileUrl(value[lightbox])}
            alt={`Photo ${lightbox + 1} of ${value.length}`}
            className="max-h-full max-w-full rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            onClick={() => setLightbox(null)}
            aria-label="Close preview"
            className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>
          <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-xs text-white">
            {lightbox + 1} / {value.length}
          </span>
        </div>
      )}

      <ConfirmDialog
        open={confirmRemove !== null}
        tone="danger"
        busy={removing}
        title={
          confirmRemove && confirmRemove.length > 1
            ? `Remove ${confirmRemove.length} photos?`
            : 'Remove this photo?'
        }
        description={
          deleteFromStorage
            ? 'The file is deleted from storage straight away. This cannot be undone.'
            : 'It is removed from this property when you save.'
        }
        consequences={
          confirmRemove?.includes(0) && value.length > 1
            ? ['This is the cover photo — the next one becomes the cover.']
            : undefined
        }
        confirmLabel="Remove"
        onConfirm={() => confirmRemove && doRemove(confirmRemove)}
        onClose={() => !removing && setConfirmRemove(null)}
      />
    </div>
  )
}

function IconAction({
  label, onClick, disabled, danger, children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={cn(
        'flex h-7 w-7 items-center justify-center rounded-md text-white transition-colors disabled:opacity-30',
        danger ? 'hover:bg-red-500' : 'hover:bg-white/25',
      )}
    >
      {children}
    </button>
  )
}
