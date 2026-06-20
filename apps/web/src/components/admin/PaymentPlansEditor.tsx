'use client'

import { Plus, X, Wallet, CalendarClock, FileText } from 'lucide-react'

export interface PaymentPlan {
  name: string
  kind: 'CASH' | 'INSTALLMENTS' | 'CUSTOM'
  downPaymentPct?: number | null
  months?: number | null
  description?: string | null
}

const KIND_META: Record<PaymentPlan['kind'], { label: string; icon: typeof Wallet; defaultName: string }> = {
  CASH: { label: 'Full cash', icon: Wallet, defaultName: 'Full Cash' },
  INSTALLMENTS: { label: 'Installments', icon: CalendarClock, defaultName: 'Installment Plan' },
  CUSTOM: { label: 'Custom', icon: FileText, defaultName: 'Custom Plan' },
}

/**
 * Reusable editor for a property's payment plans (full cash / installments /
 * custom). Used in the create and edit property forms. Pure controlled input.
 */
export function PaymentPlansEditor({ value, onChange }: { value: PaymentPlan[]; onChange: (plans: PaymentPlan[]) => void }) {
  const add = (kind: PaymentPlan['kind']) => {
    const base: PaymentPlan = { name: KIND_META[kind].defaultName, kind }
    if (kind === 'INSTALLMENTS') { base.downPaymentPct = 40; base.months = 30 }
    onChange([...value, base])
  }
  const update = (i: number, patch: Partial<PaymentPlan>) =>
    onChange(value.map((p, idx) => (idx === i ? { ...p, ...patch } : p)))
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i))

  const inp = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400'

  return (
    <div className="space-y-3">
      {value.length > 0 && (
        <div className="space-y-3">
          {value.map((p, i) => {
            const Icon = KIND_META[p.kind].icon
            return (
              <div key={i} className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-slate-500 shrink-0" />
                  <input
                    value={p.name}
                    onChange={(e) => update(i, { name: e.target.value })}
                    className={inp + ' flex-1'}
                    placeholder="Plan name"
                  />
                  <span className="text-xs text-slate-500 whitespace-nowrap px-1">{KIND_META[p.kind].label}</span>
                  <button type="button" onClick={() => remove(i)} className="p-1.5 text-slate-400 hover:text-red-600"><X className="h-4 w-4" /></button>
                </div>

                {p.kind === 'INSTALLMENTS' && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-slate-500">Down payment %</label>
                      <input type="number" min="0" max="100" value={p.downPaymentPct ?? ''} onChange={(e) => update(i, { downPaymentPct: e.target.value === '' ? null : Number(e.target.value) })} className={inp} placeholder="40" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500">Installments (months)</label>
                      <input type="number" min="1" value={p.months ?? ''} onChange={(e) => update(i, { months: e.target.value === '' ? null : Number(e.target.value) })} className={inp} placeholder="30" />
                    </div>
                  </div>
                )}

                {(p.kind === 'CUSTOM' || p.kind === 'CASH') && (
                  <input value={p.description ?? ''} onChange={(e) => update(i, { description: e.target.value })} className={inp} placeholder={p.kind === 'CASH' ? 'e.g. 5% discount on full cash payment' : 'Describe the plan terms…'} />
                )}
                {p.kind === 'INSTALLMENTS' && (
                  <input value={p.description ?? ''} onChange={(e) => update(i, { description: e.target.value })} className={inp} placeholder="Notes (optional) — e.g. interest-free, post-handover…" />
                )}
              </div>
            )
          })}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {(['CASH', 'INSTALLMENTS', 'CUSTOM'] as const).map((k) => {
          const Icon = KIND_META[k].icon
          return (
            <button key={k} type="button" onClick={() => add(k)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50">
              <Plus className="h-3.5 w-3.5" /> <Icon className="h-3.5 w-3.5" /> {KIND_META[k].label}
            </button>
          )
        })}
      </div>
      {value.length === 0 && <p className="text-xs text-slate-400">No payment plans added. Add one or more — they’ll show on the property page and the PDF proposal.</p>}
    </div>
  )
}
