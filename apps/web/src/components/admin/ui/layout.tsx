'use client'

/**
 * Page furniture for the back office: headers, section cards, the sticky save
 * bar and the in-page section nav.
 *
 * Before this, every admin page invented its own header markup and its own
 * width — `max-w-3xl` on listings, `max-w-4xl` on buildings, `max-w-5xl` plus a
 * second `min-h-screen` background on the building detail tabs, nested inside
 * the shell's own `max-w-[1600px]` container. Two of them therefore rendered a
 * page inside a page, with doubled padding and a title that didn't line up with
 * the one above it.
 */

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Check, ChevronRight, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Page header ───────────────────────────────────────────────────────────────

export interface Crumb { label: string; href?: string }

export function PageHeader({
  title, description, backHref, backLabel, crumbs, actions, meta, className,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  backHref?: string
  backLabel?: string
  crumbs?: Crumb[]
  /** Primary + secondary buttons, right-aligned on desktop, wrapped below on a phone. */
  actions?: React.ReactNode
  /** Badges / reference codes shown next to the title. */
  meta?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('mb-5', className)}>
      {crumbs && crumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="mb-2">
          <ol className="flex flex-wrap items-center gap-1 text-xs text-slate-400">
            {crumbs.map((c, i) => (
              <li key={`${c.label}-${i}`} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="h-3 w-3 shrink-0" aria-hidden="true" />}
                {c.href ? (
                  <Link href={c.href} className="transition-colors hover:text-slate-700">{c.label}</Link>
                ) : (
                  <span className="text-slate-500">{c.label}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {backHref && (
            <Link
              href={backHref}
              aria-label={backLabel ?? 'Back'}
              className="-ml-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-bold text-slate-900 sm:text-2xl">{title}</h1>
              {meta}
            </div>
            {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}

// ── Section card ──────────────────────────────────────────────────────────────

/**
 * One titled block of a long form.
 *
 * `id` is what the section nav scrolls to, and `scroll-mt-20` keeps the title
 * clear of the sticky top bar when it does — without it the heading lands
 * underneath the header and the section looks like it starts at its second
 * field.
 */
export function FormSection({
  id, title, description, icon, aside, children, className, tone = 'default',
}: {
  id?: string
  title?: React.ReactNode
  description?: React.ReactNode
  icon?: React.ReactNode
  /** Right-aligned control on the section header — a toggle, an AI button. */
  aside?: React.ReactNode
  children: React.ReactNode
  className?: string
  tone?: 'default' | 'muted'
}) {
  return (
    <section
      id={id}
      className={cn(
        'scroll-mt-20 rounded-xl border p-4 sm:p-6',
        tone === 'muted' ? 'border-slate-200 bg-slate-50/60' : 'border-slate-200 bg-white',
        className,
      )}
    >
      {(title || aside) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {title && (
              <h2 className="flex items-center gap-2 font-semibold text-slate-900">
                {icon && <span className="text-slate-400">{icon}</span>}
                {title}
              </h2>
            )}
            {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
          </div>
          {aside && <div className="shrink-0">{aside}</div>}
        </div>
      )}
      {children}
    </section>
  )
}

// ── In-page section nav ───────────────────────────────────────────────────────

export interface SectionLink { id: string; label: string; icon?: React.ComponentType<{ className?: string }> }

/**
 * A sticky list of the form's sections, with the one you're looking at marked.
 *
 * The property form is nine stacked cards; without this you scroll blind, and
 * "where do I set the ROI?" is answered by scrolling the whole thing twice.
 * Desktop only — on a phone it would cost more vertical space than it saves.
 */
export function SectionNav({ sections, className }: { sections: SectionLink[]; className?: string }) {
  const [active, setActive] = useState(sections[0]?.id)

  useEffect(() => {
    const els = sections
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => !!el)
    if (!els.length) return

    const observer = new IntersectionObserver(
      (entries) => {
        // The topmost section currently intersecting wins, so scrolling up
        // marks the section you're arriving at rather than the one you left.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActive(visible[0].target.id)
      },
      // Bias the band towards the top of the viewport: the section whose
      // heading is near the top is the one being worked on.
      { rootMargin: '-80px 0px -60% 0px', threshold: 0 },
    )
    els.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
    // Keyed on the ids, not the array: callers build `sections` inline, so a
    // dependency on the array itself would tear down and rebuild the observer
    // on every keystroke in the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections.map((s) => s.id).join(',')])

  return (
    <nav className={cn('sticky top-20 hidden w-52 shrink-0 lg:block', className)} aria-label="Form sections">
      <ul className="space-y-0.5 border-l border-slate-200">
        {sections.map((s) => {
          const on = active === s.id
          return (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                onClick={(e) => {
                  e.preventDefault()
                  document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  setActive(s.id)
                }}
                className={cn(
                  '-ml-px flex items-center gap-2 border-l-2 py-1.5 pl-3 text-sm transition-colors',
                  on
                    ? 'border-slate-800 font-medium text-slate-900'
                    : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800',
                )}
              >
                {s.icon && <s.icon className="h-3.5 w-3.5 shrink-0" />}
                {s.label}
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

// ── Sticky save bar ───────────────────────────────────────────────────────────

/**
 * The bar that says whether there is anything to save, and saves it.
 *
 * The property form's Save button used to sit at the very bottom, past nine
 * sections. Editing one field near the top meant scrolling the whole form to
 * commit it — and the "Saved" confirmation appeared down there too, where you
 * couldn't see it once you scrolled back. This stays in view, states plainly
 * whether there are unsaved changes, and takes ⌘S / Ctrl+S.
 */
export function SaveBar({
  dirty, saving, saved, onSave, onCancel, cancelHref, saveLabel = 'Save changes', error, extra, disabled,
}: {
  dirty: boolean
  saving: boolean
  saved?: boolean
  onSave: () => void
  onCancel?: () => void
  cancelHref?: string
  saveLabel?: string
  error?: string | null
  /** Anything that belongs on the bar but isn't save/cancel. */
  extra?: React.ReactNode
  disabled?: boolean
}) {
  const saveRef = useRef(onSave)
  saveRef.current = onSave

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        saveRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div
      className={cn(
        // A card rather than a full-bleed strip: this sits inside a column that
        // may have a section nav beside it, and a bar that bleeds past its own
        // column runs underneath the nav.
        'sticky bottom-3 z-30 mt-6 rounded-xl border border-slate-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur',
        'mb-[max(0.25rem,env(safe-area-inset-bottom))]',
      )}
    >
      {error && (
        <p className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 text-sm">
          {saving ? (
            <span className="flex items-center gap-2 text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Saving…
            </span>
          ) : saved ? (
            <span className="flex items-center gap-1.5 font-medium text-emerald-600">
              <Check className="h-4 w-4" /> Saved
            </span>
          ) : dirty ? (
            <span className="flex items-center gap-2 text-amber-600">
              <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" aria-hidden="true" />
              Unsaved changes
            </span>
          ) : (
            <span className="text-slate-400">No changes</span>
          )}
          {extra}
        </div>

        <div className="flex items-center gap-2">
          {cancelHref ? (
            <Link
              href={cancelHref}
              className="flex min-h-11 items-center rounded-lg px-4 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
            >
              Cancel
            </Link>
          ) : onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              className="flex min-h-11 items-center rounded-lg px-4 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
            >
              Cancel
            </button>
          ) : null}
          <button
            // Deliberately not `type="submit"`: inside a <form onSubmit>, a
            // submit button with an onClick runs both paths, and `saving` is
            // still false in the second closure — so one click saved twice, and
            // on the create form that meant two properties.
            type="button"
            onClick={onSave}
            disabled={saving || disabled}
            className="flex min-h-11 items-center gap-2 rounded-lg bg-slate-800 px-5 text-sm font-medium text-white transition-colors hover:bg-slate-700 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saveLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────

export function EmptyState({
  icon, title, description, action, className,
}: {
  icon?: React.ReactNode
  title: string
  description?: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center', className)}>
      {icon && <div className="mx-auto mb-3 flex justify-center text-slate-300">{icon}</div>}
      <p className="text-sm font-medium text-slate-600">{title}</p>
      {description && <p className="mx-auto mt-1 max-w-sm text-xs text-slate-400">{description}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────────

export function StatCard({
  icon, label, value, accent, hint, href,
}: {
  icon?: React.ReactNode
  label: React.ReactNode
  value: React.ReactNode
  accent?: string
  hint?: React.ReactNode
  href?: string
}) {
  const body = (
    <>
      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400">{icon}{label}</div>
      <div className={cn('mt-0.5 text-xl font-bold', accent ?? 'text-slate-900')}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-slate-400">{hint}</div>}
    </>
  )
  const cls = 'rounded-xl border border-slate-200 bg-white p-3'
  return href
    ? <Link href={href} className={cn(cls, 'block transition-colors hover:border-slate-300 hover:bg-slate-50')}>{body}</Link>
    : <div className={cls}>{body}</div>
}
