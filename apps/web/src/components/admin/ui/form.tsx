'use client'

/**
 * The back-office form vocabulary.
 *
 * Every admin form used to re-declare its own `inputCls` / `labelCls` string at
 * the top of the file — there were six of them, all slightly different (slate
 * vs zinc borders, `text-xs` vs `text-sm` labels, two different focus rings),
 * which is why two screens editing the same record never looked like the same
 * product. They live here now, once.
 *
 * Mobile rules that these bake in so no caller has to remember them:
 *  - controls stay at `text-sm`, which `globals.css` floors at 16px below
 *    `md` — anything smaller makes iOS Safari zoom in and never zoom back out
 *  - anything a thumb has to hit is `min-h-11` (~44px)
 *
 * ── Colour ──────────────────────────────────────────────────────────────────
 *
 * Seven accent hues were in use across the back office and none of them meant
 * anything: the create-listing panel was blue and the edit-listing panel was
 * amber, which looks like a status and is just a form. When every panel is a
 * different colour, colour stops carrying information and the screen reads as
 * decoration you have to see past.
 *
 * Five, each with one job:
 *
 *   slate    structure, text, and every primary action
 *   emerald  live, published, on the market, on
 *   amber    needs attention — unsaved, draft, over budget, a warning
 *   red      destroys something
 *   violet   AI wrote this
 *
 * `sky` survives in exactly one place: paired with emerald to tell FOR_RENT
 * from FOR_SALE, where it is a data category rather than a mood.
 *
 * Text contrast: body copy is `text-slate-500` or darker. `text-slate-400` is
 * 2.85:1 on white and fails WCAG AA, so it is for decorative icons and
 * placeholders only — 134 pieces of real text were set in it.
 */

import { forwardRef, useId, useState } from 'react'
import { AlertCircle, Check, ChevronDown, Info, Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Shared class recipes ──────────────────────────────────────────────────────

export const controlCls =
  'w-full min-h-11 px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm bg-white text-slate-900 ' +
  'placeholder:text-slate-400 transition-colors ' +
  'focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 ' +
  'disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed'

export const invalidCls = 'border-red-300 focus:border-red-400 focus:ring-red-500/10'

// ── Field: label + hint + error, wrapped around any control ───────────────────

export interface FieldProps {
  label?: React.ReactNode
  /** Explains what the value is for. Sits under the control, not in a tooltip. */
  hint?: React.ReactNode
  error?: string | null
  required?: boolean
  /** Renders a muted "optional" so the *absence* of a required marker is legible. */
  optional?: boolean
  /** Column span inside a `FieldGrid`. */
  span?: 1 | 2 | 3 | 4 | 'full'
  className?: string
  htmlFor?: string
  children: React.ReactNode
}

const SPAN_CLS: Record<NonNullable<FieldProps['span']>, string> = {
  1: '',
  2: 'sm:col-span-2',
  3: 'sm:col-span-3',
  4: 'sm:col-span-4',
  full: 'col-span-full',
}

export function Field({
  label, hint, error, required, optional, span = 1, className, htmlFor, children,
}: FieldProps) {
  return (
    <div className={cn(SPAN_CLS[span], className)}>
      {label && (
        <label htmlFor={htmlFor} className="mb-1.5 flex items-baseline gap-1.5 text-sm font-medium text-slate-700">
          <span>{label}</span>
          {required && <span className="text-red-500" aria-hidden="true">*</span>}
          {optional && !required && <span className="text-xs font-normal text-slate-400">optional</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="mt-1.5 flex items-start gap-1 text-xs text-red-600">
          <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{hint}</p>
      ) : null}
    </div>
  )
}

/** The standard responsive grid a form section lays its fields out on. */
export function FieldGrid({
  cols = 2, className, children,
}: { cols?: 2 | 3 | 4; className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-x-5 gap-y-5',
        cols === 2 && 'sm:grid-cols-2',
        cols === 3 && 'sm:grid-cols-3',
        // Four across is too tight below `sm`; two is the honest maximum on a
        // phone, and these are number fields where the label does the work.
        cols === 4 && 'grid-cols-2 sm:grid-cols-4',
        className,
      )}
    >
      {children}
    </div>
  )
}

// ── Controls ──────────────────────────────────────────────────────────────────

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }

export const TextInput = forwardRef<HTMLInputElement, InputProps>(
  function TextInput({ className, invalid, ...props }, ref) {
    return (
      <input
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(controlCls, invalid && invalidCls, className)}
        {...props}
      />
    )
  },
)

/**
 * A number field that reports an empty string rather than `NaN`.
 *
 * Every form here stores numbers as strings while editing (so a half-typed
 * "1" isn't coerced to 1 and re-rendered), and `''` is the only honest way to
 * say "not set". `unit` renders a suffix inside the control — "m²", "%", "yrs"
 * — because the label already carries the field's name and repeating the unit
 * there makes the label wrap on a phone.
 */
export const NumberInput = forwardRef<HTMLInputElement, InputProps & { unit?: string }>(
  function NumberInput({ className, invalid, unit, ...props }, ref) {
    if (!unit) {
      return (
        <input
          ref={ref}
          type="number"
          inputMode="decimal"
          aria-invalid={invalid || undefined}
          className={cn(controlCls, invalid && invalidCls, className)}
          {...props}
        />
      )
    }
    return (
      <div className="relative">
        <input
          ref={ref}
          type="number"
          inputMode="decimal"
          aria-invalid={invalid || undefined}
          className={cn(controlCls, 'pr-12', invalid && invalidCls, className)}
          {...props}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400">
          {unit}
        </span>
      </div>
    )
  },
)

/** A money field with the currency symbol rendered inside the control. */
export const MoneyInput = forwardRef<HTMLInputElement, InputProps & { currency?: string }>(
  function MoneyInput({ className, invalid, currency = 'USD', ...props }, ref) {
    const symbol = currency === 'USD' ? '$' : currency
    return (
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-400">
          {symbol}
        </span>
        <input
          ref={ref}
          type="number"
          inputMode="decimal"
          min="0"
          aria-invalid={invalid || undefined}
          className={cn(controlCls, symbol.length > 1 ? 'pl-12' : 'pl-7', invalid && invalidCls, className)}
          {...props}
        />
      </div>
    )
  },
)

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }

export const SelectInput = forwardRef<HTMLSelectElement, SelectProps>(
  function SelectInput({ className, invalid, children, ...props }, ref) {
    return (
      <div className="relative">
        <select
          ref={ref}
          aria-invalid={invalid || undefined}
          className={cn(controlCls, 'appearance-none pr-9', invalid && invalidCls, className)}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          aria-hidden="true"
        />
      </div>
    )
  },
)

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ className, invalid, rows = 4, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        rows={rows}
        aria-invalid={invalid || undefined}
        className={cn(controlCls, 'min-h-0 resize-y leading-relaxed', invalid && invalidCls, className)}
        {...props}
      />
    )
  },
)

/**
 * A textarea that shows how much of a length budget is used.
 *
 * Meta descriptions get truncated by Google at ~160 characters; writing one
 * blind and finding out from a search result later is the failure this closes.
 * Over budget is amber, not red — it still saves.
 */
export function CountedTextarea({
  value, max, className, ...props
}: TextareaProps & { value: string; max: number }) {
  const len = value.length
  const over = len > max
  return (
    <div>
      <Textarea value={value} className={className} {...props} />
      <p className={cn('mt-1 text-right text-xs tabular-nums', over ? 'text-amber-600' : 'text-slate-400')}>
        {len} / {max}
      </p>
    </div>
  )
}

// ── Toggles ───────────────────────────────────────────────────────────────────

/**
 * A switch, for a setting that takes effect on its own.
 *
 * Distinct from `CheckboxCard` on purpose: a switch reads as "this is on now",
 * a checkbox as "this is one of several I am picking". Amenities are a pick
 * list; "Featured" is a state.
 */
export function Toggle({
  checked, onChange, label, hint, disabled, id: idProp,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: React.ReactNode
  hint?: React.ReactNode
  disabled?: boolean
  id?: string
}) {
  const auto = useId()
  const id = idProp ?? auto
  return (
    <div className="flex items-start gap-3.5">
      {/* The switch is 24px tall but sits in a 44px target.
          `-my-2.5 py-2.5` grows the hit area without moving anything: the
          control has to be thumb-sized on a phone, and it has to not push the
          label off its own baseline to get there. */}
      <button
        type="button"
        role="switch"
        id={id}
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'group -my-2.5 flex shrink-0 items-center py-2.5',
          'focus:outline-none',
          disabled && 'cursor-not-allowed opacity-50',
        )}
      >
        <span
          className={cn(
            'relative block h-6 w-11 rounded-full transition-colors',
            // The off state used to be `bg-slate-200` behind a white knob —
            // about 1.15:1 between the two, on panels that are themselves
            // slate-50. It read as a washed-out blob you couldn't tell the
            // state of. The track is now darker than the knob by a clear
            // margin, and carries an inset border so it reads as a control
            // even against a grey card.
            checked
              ? 'bg-emerald-600 ring-1 ring-inset ring-emerald-700/20'
              : 'bg-slate-300 ring-1 ring-inset ring-slate-400/30',
            !disabled && !checked && 'group-hover:bg-slate-400',
            !disabled && checked && 'group-hover:bg-emerald-700',
            'group-focus-visible:ring-2 group-focus-visible:ring-slate-900/30 group-focus-visible:ring-offset-2',
          )}
        >
          <span
            className={cn(
              'absolute top-0.5 block h-5 w-5 rounded-full bg-white shadow-sm ring-1 ring-slate-900/10',
              'transition-transform duration-150',
              checked ? 'translate-x-[1.375rem]' : 'translate-x-0.5',
            )}
          />
        </span>
      </button>
      <label htmlFor={id} className={cn('cursor-pointer select-none pt-0.5', disabled && 'cursor-not-allowed')}>
        <span className="block text-sm font-medium text-slate-800">{label}</span>
        {hint && <span className="mt-1 block text-xs leading-relaxed text-slate-500">{hint}</span>}
      </label>
    </div>
  )
}

/** A checkbox styled as a tappable card — used for amenity-style pick lists. */
export function CheckboxCard({
  checked, onChange, label, icon, disabled,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: React.ReactNode
  icon?: React.ReactNode
  disabled?: boolean
}) {
  return (
    <label
      className={cn(
        'flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-3 transition-colors',
        checked
          ? 'border-slate-800 bg-slate-800/[0.04] text-slate-900'
          : 'border-slate-200 text-slate-700 hover:bg-slate-50',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <span
        className={cn(
          'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
          checked ? 'border-slate-800 bg-slate-800' : 'border-slate-300 bg-white',
        )}
        aria-hidden="true"
      >
        {checked && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
      </span>
      {icon && <span className="shrink-0 text-slate-400">{icon}</span>}
      <span className="text-sm">{label}</span>
    </label>
  )
}

/**
 * A row of mutually exclusive choices, for a two-or-three-way decision.
 *
 * A `<select>` hides the options behind a tap; when there are only two or three
 * and the choice changes what the rest of the form shows — sale vs rent, total
 * price vs price per m² — they should be visible without one.
 */
export function SegmentedControl<T extends string>({
  value, onChange, options, size = 'md', className,
}: {
  value: T
  onChange: (next: T) => void
  options: Array<{ value: T; label: React.ReactNode; hint?: string }>
  size?: 'sm' | 'md'
  className?: string
}) {
  return (
    <div
      role="radiogroup"
      className={cn('inline-flex w-full rounded-lg border border-slate-200 bg-slate-50 p-1 sm:w-auto', className)}
    >
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={o.hint}
            onClick={() => onChange(o.value)}
            className={cn(
              'flex-1 rounded-md px-3 text-sm font-medium transition-colors sm:flex-none',
              size === 'sm' ? 'min-h-9 py-1.5' : 'min-h-9 py-2',
              active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

// ── Chips ─────────────────────────────────────────────────────────────────────

/**
 * A free-text list — highlighted features, listing highlights, unit features.
 *
 * Three screens each had their own copy of "input + plus button + map over
 * pills", and only one of them let you remove the last entry with Backspace.
 * `suggestions` matter more than they look: left to free text alone, the same
 * feature gets typed "Sea view", "sea-view" and "Seaview" across a catalogue
 * and no filter can ever group them.
 */
export function ChipsInput({
  value, onChange, placeholder, suggestions = [], disabled,
}: {
  value: string[]
  onChange: (next: string[]) => void
  placeholder?: string
  suggestions?: string[]
  disabled?: boolean
}) {
  const [draft, setDraft] = useState('')

  function add(raw: string) {
    const v = raw.trim()
    if (!v) return
    // Case-insensitive de-dupe: "Sea view" and "sea view" are the same feature.
    if (value.some((x) => x.toLowerCase() === v.toLowerCase())) { setDraft(''); return }
    onChange([...value, v])
    setDraft('')
  }

  const unused = suggestions.filter(
    (s) => !value.some((v) => v.toLowerCase() === s.toLowerCase()),
  )

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <TextInput
          value={draft}
          disabled={disabled}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); add(draft) }
            // Backspace on an empty box removes the last chip — the same
            // gesture every tag input on the web has.
            if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1))
          }}
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={() => add(draft)}
          disabled={disabled || !draft.trim()}
          className="flex min-h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-white transition-colors hover:bg-slate-700 disabled:opacity-40"
          aria-label="Add"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((v, i) => (
            <span
              key={`${v}-${i}`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 py-1.5 pl-3 pr-1.5 text-sm text-slate-700"
            >
              {v}
              <button
                type="button"
                onClick={() => onChange(value.filter((_, idx) => idx !== i))}
                className="rounded p-0.5 text-slate-400 transition-colors hover:bg-slate-200 hover:text-red-600"
                aria-label={`Remove ${v}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      {unused.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-slate-500">Common:</span>
          {unused.slice(0, 8).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              disabled={disabled}
              className="rounded-md border border-dashed border-slate-300 px-2 py-1 text-xs text-slate-500 transition-colors hover:border-slate-400 hover:bg-slate-50 hover:text-slate-800"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** Multi-select over a closed list, rendered as toggleable pills. */
export function PillSelect({
  value, onChange, options, disabled,
}: {
  value: string[]
  onChange: (next: string[]) => void
  options: Array<{ value: string; label: string }>
  disabled?: boolean
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = value.includes(o.value)
        return (
          <button
            key={o.value}
            type="button"
            disabled={disabled}
            aria-pressed={active}
            onClick={() => onChange(active ? value.filter((v) => v !== o.value) : [...value, o.value])}
            className={cn(
              'min-h-9 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
              active
                ? 'border-slate-800 bg-slate-800 text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

// ── Inline messages ───────────────────────────────────────────────────────────

export function InlineNote({
  tone = 'info', children, className,
}: {
  tone?: 'info' | 'warning' | 'error' | 'success'
  children: React.ReactNode
  className?: string
}) {
  const TONE = {
    info: 'bg-sky-50 border-sky-200 text-sky-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    error: 'bg-red-50 border-red-200 text-red-700',
    success: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  }[tone]
  const Icon = tone === 'error' || tone === 'warning' ? AlertCircle : tone === 'success' ? Check : Info
  return (
    <div className={cn('flex items-start gap-2 rounded-xl border px-3.5 py-2.5 text-sm', TONE, className)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
