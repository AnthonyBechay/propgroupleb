'use client'

import { useEffect, useState } from 'react'
import { Eye, EyeOff, Loader2, RefreshCw, Shield, X } from 'lucide-react'
import {
  ASSIGNABLE_ROLES, ROLE_LABELS, ROLE_DESCRIPTIONS, type Role,
} from '@/lib/permissions'
import { createUser, updateUser, setUserPassword, type ManagedUser } from '@/lib/api/users'

type Mode = 'create' | 'edit' | 'password'

/**
 * Create a user, edit one, or set someone's password.
 *
 * One dialog rather than three because they are the same six fields in
 * different combinations, and because the thing this replaced — an "invite"
 * modal — created accounts with no password at all and told the operator an
 * email had been sent that nothing ever sent.
 *
 * Generating the password here (rather than asking the operator to invent one)
 * is deliberate: this dialog is the only place the value is ever visible, so it
 * should be a good one and it should be easy to copy.
 */
export function UserFormModal({
  mode,
  user,
  onClose,
  onSaved,
}: {
  mode: Mode
  user?: ManagedUser | null
  onClose: () => void
  onSaved: () => void
}) {
  const [email, setEmail] = useState(user?.email ?? '')
  const [firstName, setFirstName] = useState(user?.firstName ?? '')
  const [lastName, setLastName] = useState(user?.lastName ?? '')
  const [phone, setPhone] = useState(user?.phone ?? '')
  const [role, setRole] = useState<Role>(user?.role ?? 'CRM_MANAGER')
  const [isActive, setIsActive] = useState(user?.isActive ?? true)
  const [password, setPassword] = useState('')
  const [reveal, setReveal] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Escape closes it — a dialog that traps you on a phone with no visible
  // keyboard shortcut is a dialog people force-reload out of.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  useEffect(() => {
    if (mode === 'create' || mode === 'password') setPassword(suggestPassword())
  }, [mode])

  const title =
    mode === 'create' ? 'Create user'
    : mode === 'password' ? `Set password — ${user?.email}`
    : `Edit ${user?.email}`

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (mode === 'create') {
        await createUser({
          email: email.trim(),
          password,
          role,
          firstName: firstName.trim() || undefined,
          lastName: lastName.trim() || undefined,
          phone: phone.trim() || undefined,
          isActive,
        })
      } else if (mode === 'password' && user) {
        await setUserPassword(user.id, password)
      } else if (user) {
        await updateUser(user.id, {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim(),
          role,
          isActive,
        })
      }
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  const showIdentity = mode !== 'password'
  const showPassword = mode !== 'edit'

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        /* Bottom sheet on a phone, centred card above `sm`. `max-h` plus an
           inner scroll keeps the buttons reachable when the keyboard is up. */
        className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto overscroll-contain rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl"
      >
        <div className="sticky top-0 flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-3 sm:px-5">
          <Shield className="h-5 w-5 shrink-0 text-zinc-700" />
          <h2 className="min-w-0 flex-1 truncate text-base font-semibold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4 px-4 py-4 sm:px-5">
          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}

          {mode === 'create' && (
            <Field label="Email">
              <input
                type="email"
                required
                autoComplete="off"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputCls}
                placeholder="name@propgroup.com"
              />
            </Field>
          )}

          {showIdentity && (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="First name">
                  <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputCls} />
                </Field>
                <Field label="Last name">
                  <input value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputCls} />
                </Field>
              </div>

              <Field label="Phone">
                <input
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={inputCls}
                />
              </Field>

              <Field label="Role">
                <div className="space-y-1.5">
                  {ASSIGNABLE_ROLES.map((r) => (
                    <label
                      key={r}
                      className={`flex min-h-11 cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 transition-colors ${
                        role === r ? 'border-zinc-900 bg-zinc-50' : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="role"
                        checked={role === r}
                        onChange={() => setRole(r)}
                        className="mt-1 h-4 w-4 shrink-0 accent-zinc-900"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-slate-900">{ROLE_LABELS[r]}</span>
                        <span className="block text-xs text-slate-500">{ROLE_DESCRIPTIONS[r]}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </Field>

              <label className="flex min-h-11 cursor-pointer items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="h-4 w-4 accent-zinc-900"
                />
                <span className="text-sm text-slate-700">
                  Account is active
                  <span className="block text-xs text-slate-500">Turning this off also lifts any ban when turned back on.</span>
                </span>
              </label>
            </>
          )}

          {showPassword && (
            <Field label="Password">
              <div className="flex gap-2">
                <input
                  type={reveal ? 'text' : 'password'}
                  required
                  value={password}
                  autoComplete="new-password"
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${inputCls} font-mono`}
                />
                <button
                  type="button"
                  onClick={() => setReveal((v) => !v)}
                  aria-label={reveal ? 'Hide password' : 'Show password'}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
                >
                  {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => setPassword(suggestPassword())}
                  aria-label="Generate a new password"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-1.5 text-xs text-slate-500">
                At least 8 characters with one capital and one digit. Copy it now — this dialog is the
                only place it is ever shown.
              </p>
            </Field>
          )}

          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === 'create' ? 'Create user' : mode === 'password' ? 'Set password' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* `text-base` below `sm` is not a style choice: iOS Safari zooms the whole page
   in when it focuses an input under 16px, and the admin's 14px fields made every
   form on a phone jump and then need pinching back out. */
const inputCls =
  'w-full min-h-11 rounded-lg border border-slate-200 px-3 text-base sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </label>
  )
}

/**
 * A password that satisfies the backend rule on the first try, every time.
 *
 * Drawn from `crypto.getRandomValues`, not `Math.random` — this is the actual
 * credential for a back-office account, and `Math.random` is a predictable PRNG
 * that browsers make no security promises about. Ambiguous glyphs (O/0, I/l/1)
 * are left out because these get read aloud and retyped.
 */
function suggestPassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const lower = 'abcdefghijkmnopqrstuvwxyz'
  const digits = '23456789'
  const all = upper + lower + digits

  const bytes = new Uint32Array(16)
  crypto.getRandomValues(bytes)
  let cursor = 0
  const pick = (set: string) => set[bytes[cursor++] % set.length]

  // Guarantee the capital and the digit rather than hoping for them.
  const chars = [pick(upper), pick(digits), ...Array.from({ length: 12 }, () => pick(all))]

  const shuffle = new Uint32Array(chars.length)
  crypto.getRandomValues(shuffle)
  for (let i = chars.length - 1; i > 0; i--) {
    const j = shuffle[i] % (i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}
