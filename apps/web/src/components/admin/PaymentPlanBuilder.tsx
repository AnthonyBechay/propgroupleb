'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2 } from 'lucide-react'

export const PAYMENT_PLAN_TYPES = [
  { value: 'LUMP_SUM', label: 'Lump Sum (Full Payment)' },
  { value: 'SPLIT', label: 'Split Payment (e.g., 30/70)' },
  { value: 'INSTALLMENTS', label: 'Monthly/Quarterly Installments' },
  { value: 'CONSTRUCTION_LINKED', label: 'Construction-Linked' },
  { value: 'HYBRID', label: 'Hybrid (Initial + Installments + Bulk)' },
  { value: 'POST_HANDOVER', label: 'Post-Handover Payment Plan' },
  { value: 'CUSTOM', label: 'Custom Plan' },
] as const

export type PaymentMilestone = {
  label: string
  percentage: number
  dueDate?: string
  description?: string
}

export type PaymentPlanDetails = {
  planType: string
  summary: string
  milestones: PaymentMilestone[]
  totalInstallments?: number
  installmentFrequency?: string // monthly, quarterly, yearly
  installmentAmount?: number
  postHandoverMonths?: number
  postHandoverPercentage?: number
  notes?: string
}

const TEMPLATES: Record<string, PaymentPlanDetails> = {
  LUMP_SUM: {
    planType: 'LUMP_SUM',
    summary: '100% payment on booking',
    milestones: [{ label: 'Full Payment', percentage: 100, description: 'On booking/signing' }],
  },
  SPLIT: {
    planType: 'SPLIT',
    summary: '30% down payment, 70% on completion',
    milestones: [
      { label: 'Down Payment', percentage: 30, description: 'On booking' },
      { label: 'On Completion', percentage: 70, description: 'On handover' },
    ],
  },
  INSTALLMENTS: {
    planType: 'INSTALLMENTS',
    summary: '20% down payment, balance in monthly installments',
    milestones: [
      { label: 'Down Payment', percentage: 20, description: 'On booking' },
      { label: 'Monthly Installments', percentage: 80, description: 'During construction' },
    ],
    installmentFrequency: 'monthly',
  },
  CONSTRUCTION_LINKED: {
    planType: 'CONSTRUCTION_LINKED',
    summary: '20% booking, 30% during construction, 50% on handover',
    milestones: [
      { label: 'Booking', percentage: 20, description: 'On reservation' },
      { label: 'Foundation Complete', percentage: 10, description: 'On foundation completion' },
      { label: 'Structure Complete', percentage: 10, description: 'On structure completion' },
      { label: 'Finishing Stage', percentage: 10, description: 'On finishing' },
      { label: 'On Handover', percentage: 50, description: 'On key handover' },
    ],
  },
  HYBRID: {
    planType: 'HYBRID',
    summary: '10% down, monthly payments to 50%, then bulk payment on completion',
    milestones: [
      { label: 'Initial Payment', percentage: 10, description: 'On booking' },
      { label: 'Monthly Installments', percentage: 40, description: 'Monthly until 50% reached' },
      { label: 'Bulk Payment on Completion', percentage: 50, description: 'On handover' },
    ],
    installmentFrequency: 'monthly',
  },
  POST_HANDOVER: {
    planType: 'POST_HANDOVER',
    summary: '30% during construction, 70% post-handover over 3 years',
    milestones: [
      { label: 'During Construction', percentage: 30, description: 'Payments during build' },
      { label: 'Post-Handover Payments', percentage: 70, description: 'Monthly after handover' },
    ],
    postHandoverMonths: 36,
    postHandoverPercentage: 70,
    installmentFrequency: 'monthly',
  },
  CUSTOM: {
    planType: 'CUSTOM',
    summary: '',
    milestones: [{ label: '', percentage: 0, description: '' }],
  },
}

export function PaymentPlanBuilder({
  value,
  onChange,
  labelClass,
  inputClass,
}: {
  value: PaymentPlanDetails | null
  onChange: (details: PaymentPlanDetails | null) => void
  labelClass: string
  inputClass: string
}) {
  const [enabled, setEnabled] = useState(!!value)

  // Sync enabled with value when edited from parent (e.g., modal opens with existing plan)
  useEffect(() => {
    setEnabled(!!value)
  }, [value])

  const handleEnable = (checked: boolean) => {
    setEnabled(checked)
    if (checked && !value) {
      onChange(TEMPLATES.SPLIT)
    } else if (!checked) {
      onChange(null)
    }
  }

  const updatePlan = (updates: Partial<PaymentPlanDetails>) => {
    if (!value) return
    onChange({ ...value, ...updates })
  }

  const addMilestone = () => {
    if (!value) return
    const totalUsed = value.milestones.reduce((s, m) => s + m.percentage, 0)
    onChange({
      ...value,
      milestones: [
        ...value.milestones,
        { label: '', percentage: Math.max(0, 100 - totalUsed), description: '' },
      ],
    })
  }

  const updateMilestone = (index: number, updates: Partial<PaymentMilestone>) => {
    if (!value) return
    const milestones = [...value.milestones]
    milestones[index] = { ...milestones[index], ...updates }
    onChange({ ...value, milestones })
  }

  const removeMilestone = (index: number) => {
    if (!value) return
    onChange({ ...value, milestones: value.milestones.filter((_, i) => i !== index) })
  }

  const applyTemplate = (planType: string) => {
    const template = TEMPLATES[planType] || TEMPLATES.CUSTOM
    onChange(template)
  }

  const totalPercentage = value?.milestones.reduce((s, m) => s + (m.percentage || 0), 0) || 0

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50/50">
      <div className="flex items-center gap-2 mb-3">
        <input
          type="checkbox"
          id="enable-payment-plan"
          checked={enabled}
          onChange={(e) => handleEnable(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <label htmlFor="enable-payment-plan" className="text-sm font-semibold text-gray-800">
          Payment Plan
        </label>
      </div>

      {enabled && value && (
        <div className="space-y-4">
          {/* Plan Type Selector */}
          <div>
            <label className={labelClass}>Plan Type</label>
            <select
              className={inputClass}
              value={value.planType}
              onChange={(e) => applyTemplate(e.target.value)}
            >
              {PAYMENT_PLAN_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Summary */}
          <div>
            <label className={labelClass}>Summary (shown to users)</label>
            <input
              className={inputClass}
              value={value.summary}
              onChange={(e) => updatePlan({ summary: e.target.value })}
              placeholder="e.g., 30% down payment, 70% on completion"
            />
          </div>

          {/* Milestones */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={labelClass + ' !mb-0'}>Payment Milestones</label>
              <span className={`text-xs font-medium ${totalPercentage === 100 ? 'text-green-600' : 'text-amber-600'}`}>
                Total: {totalPercentage}%{totalPercentage !== 100 && ' (should be 100%)'}
              </span>
            </div>
            <div className="space-y-2">
              {value.milestones.map((milestone, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <input
                    className={inputClass + ' flex-[2]'}
                    value={milestone.label}
                    onChange={(e) => updateMilestone(i, { label: e.target.value })}
                    placeholder="Label (e.g., Down Payment)"
                  />
                  <div className="flex items-center gap-1 flex-[1]">
                    <input
                      className={inputClass + ' w-20 text-center'}
                      type="number"
                      min={0}
                      max={100}
                      value={milestone.percentage}
                      onChange={(e) => updateMilestone(i, { percentage: Number(e.target.value) })}
                    />
                    <span className="text-sm text-gray-500">%</span>
                  </div>
                  <input
                    className={inputClass + ' flex-[2]'}
                    value={milestone.description || ''}
                    onChange={(e) => updateMilestone(i, { description: e.target.value })}
                    placeholder="When / description"
                  />
                  <input
                    className={inputClass + ' flex-[1]'}
                    type="date"
                    value={milestone.dueDate || ''}
                    onChange={(e) => updateMilestone(i, { dueDate: e.target.value })}
                  />
                  {value.milestones.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeMilestone(i)}
                      className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addMilestone}
              className="mt-2 text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              <Plus className="h-3 w-3" /> Add Milestone
            </button>
          </div>

          {/* Installment Details (for relevant plan types) */}
          {['INSTALLMENTS', 'HYBRID', 'POST_HANDOVER'].includes(value.planType) && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-gray-200">
              <div>
                <label className={labelClass}>Installment Frequency</label>
                <select
                  className={inputClass}
                  value={value.installmentFrequency || 'monthly'}
                  onChange={(e) => updatePlan({ installmentFrequency: e.target.value })}
                >
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="semi-annual">Semi-Annual</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Total Installments</label>
                <input
                  className={inputClass}
                  type="number"
                  min={1}
                  value={value.totalInstallments || ''}
                  onChange={(e) => updatePlan({ totalInstallments: e.target.value ? Number(e.target.value) : undefined })}
                  placeholder="e.g., 36"
                />
              </div>
              <div>
                <label className={labelClass}>Installment Amount</label>
                <input
                  className={inputClass}
                  type="number"
                  min={0}
                  value={value.installmentAmount || ''}
                  onChange={(e) => updatePlan({ installmentAmount: e.target.value ? Number(e.target.value) : undefined })}
                  placeholder="Per installment"
                />
              </div>
            </div>
          )}

          {/* Post-Handover Details */}
          {value.planType === 'POST_HANDOVER' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-gray-200">
              <div>
                <label className={labelClass}>Post-Handover Period (months)</label>
                <input
                  className={inputClass}
                  type="number"
                  min={1}
                  value={value.postHandoverMonths || ''}
                  onChange={(e) => updatePlan({ postHandoverMonths: e.target.value ? Number(e.target.value) : undefined })}
                  placeholder="e.g., 36"
                />
              </div>
              <div>
                <label className={labelClass}>Post-Handover %</label>
                <input
                  className={inputClass}
                  type="number"
                  min={0}
                  max={100}
                  value={value.postHandoverPercentage || ''}
                  onChange={(e) => updatePlan({ postHandoverPercentage: e.target.value ? Number(e.target.value) : undefined })}
                  placeholder="% paid post-handover"
                />
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className={labelClass}>Internal Notes</label>
            <textarea
              className={`${inputClass} resize-none`}
              rows={2}
              value={value.notes || ''}
              onChange={(e) => updatePlan({ notes: e.target.value })}
              placeholder="Additional notes about the payment plan (not shown to users)"
            />
          </div>
        </div>
      )}
    </div>
  )
}
