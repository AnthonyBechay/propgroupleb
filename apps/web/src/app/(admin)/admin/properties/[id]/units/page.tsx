'use client'

import { useState, useEffect, use } from 'react'
import { normalizeApiUrl } from '@/lib/utils/api-url'
import { ArrowLeft, Plus, Trash2, Edit2, Loader2, Building2, Bed, Bath, Maximize, DollarSign } from 'lucide-react'
import Link from 'next/link'
import type { Unit, UnitOption } from '@/lib/types/api'

const API = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL)

const AVAILABILITY_COLORS: Record<string, string> = {
  AVAILABLE: 'bg-emerald-100 text-emerald-700',
  RESERVED: 'bg-amber-100 text-amber-700',
  SOLD: 'bg-red-100 text-red-700',
  OFF_MARKET: 'bg-gray-100 text-gray-600',
}

const FINISH_PRESETS = ['Turnkey', 'White Frame', 'Black Frame', 'Renovated', 'Semi-Finished', 'Shell & Core']

type UnitFormData = {
  name: string
  unitNumber: string
  bedrooms: number
  bathrooms: number
  area: number
  floor: string
  parkingSpaces: string
  notes: string
  availabilityStatus: string
}

type OptionFormData = {
  name: string
  pricePerSqm: number
  currency: string
  initialPayment: string
  description: string
}

const emptyUnit: UnitFormData = {
  name: '', unitNumber: '', bedrooms: 1, bathrooms: 1, area: 0,
  floor: '', parkingSpaces: '', notes: '', availabilityStatus: 'AVAILABLE'
}

const emptyOption: OptionFormData = {
  name: '', pricePerSqm: 0, currency: 'USD', initialPayment: '', description: ''
}

export default function UnitsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: propertyId } = use(params)
  const [units, setUnits] = useState<Unit[]>([])
  const [projectTitle, setProjectTitle] = useState('')
  const [loading, setLoading] = useState(true)

  // Unit form state
  const [showAddUnit, setShowAddUnit] = useState(false)
  const [editingUnit, setEditingUnit] = useState<string | null>(null)
  const [unitForm, setUnitForm] = useState<UnitFormData>({ ...emptyUnit })
  const [unitSaving, setUnitSaving] = useState(false)

  // Option form state
  const [showAddOption, setShowAddOption] = useState<string | null>(null) // unitId
  const [editingOption, setEditingOption] = useState<{ unitId: string; optionId: string } | null>(null)
  const [optionForm, setOptionForm] = useState<OptionFormData>({ ...emptyOption })
  const [optionSaving, setOptionSaving] = useState(false)

  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
  }, [propertyId])

  async function fetchData() {
    setLoading(true)
    try {
      const [propRes, unitsRes] = await Promise.all([
        fetch(`${API}/api/properties/${propertyId}`, { credentials: 'include' }),
        fetch(`${API}/api/properties/${propertyId}/units`, { credentials: 'include' }),
      ])
      const propData = await propRes.json()
      const unitsData = await unitsRes.json()
      setProjectTitle(propData.data?.title || propData.title || 'Project')
      setUnits(unitsData.data || [])
    } catch {
      setError('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  // ─── Unit CRUD ─────────────────────────────────────────────────────────────

  async function saveUnit(e: React.FormEvent) {
    e.preventDefault()
    setUnitSaving(true)
    setError(null)
    try {
      const payload = {
        name: unitForm.name,
        unitNumber: unitForm.unitNumber || null,
        bedrooms: Number(unitForm.bedrooms),
        bathrooms: Number(unitForm.bathrooms),
        area: Number(unitForm.area),
        floor: unitForm.floor ? Number(unitForm.floor) : null,
        parkingSpaces: unitForm.parkingSpaces ? Number(unitForm.parkingSpaces) : null,
        notes: unitForm.notes || null,
        availabilityStatus: unitForm.availabilityStatus,
      }
      const url = editingUnit
        ? `${API}/api/properties/${propertyId}/units/${editingUnit}`
        : `${API}/api/properties/${propertyId}/units`
      const res = await fetch(url, {
        method: editingUnit ? 'PUT' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error((await res.json()).message || 'Failed to save unit')
      setShowAddUnit(false)
      setEditingUnit(null)
      setUnitForm({ ...emptyUnit })
      await fetchData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setUnitSaving(false)
    }
  }

  async function deleteUnit(unitId: string, unitName: string) {
    if (!confirm(`Delete unit "${unitName}"? All options will be removed.`)) return
    try {
      await fetch(`${API}/api/properties/${propertyId}/units/${unitId}`, {
        method: 'DELETE', credentials: 'include',
      })
      await fetchData()
    } catch {
      setError('Failed to delete unit')
    }
  }

  function startEditUnit(unit: Unit) {
    setEditingUnit(unit.id)
    setUnitForm({
      name: unit.name,
      unitNumber: unit.unitNumber || '',
      bedrooms: unit.bedrooms,
      bathrooms: unit.bathrooms,
      area: unit.area,
      floor: unit.floor?.toString() || '',
      parkingSpaces: unit.parkingSpaces?.toString() || '',
      notes: unit.notes || '',
      availabilityStatus: unit.availabilityStatus,
    })
    setShowAddUnit(true)
  }

  // ─── Option CRUD ───────────────────────────────────────────────────────────

  async function saveOption(e: React.FormEvent, unitId: string) {
    e.preventDefault()
    setOptionSaving(true)
    setError(null)
    try {
      const payload = {
        name: optionForm.name,
        pricePerSqm: Number(optionForm.pricePerSqm),
        currency: optionForm.currency,
        initialPayment: optionForm.initialPayment ? Number(optionForm.initialPayment) : null,
        description: optionForm.description || null,
      }
      const optionId = editingOption?.optionId
      const url = optionId
        ? `${API}/api/properties/${propertyId}/units/${unitId}/options/${optionId}`
        : `${API}/api/properties/${propertyId}/units/${unitId}/options`
      const res = await fetch(url, {
        method: optionId ? 'PUT' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error((await res.json()).message || 'Failed to save option')
      setShowAddOption(null)
      setEditingOption(null)
      setOptionForm({ ...emptyOption })
      await fetchData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setOptionSaving(false)
    }
  }

  async function deleteOption(unitId: string, optionId: string, name: string) {
    if (!confirm(`Delete option "${name}"?`)) return
    try {
      await fetch(`${API}/api/properties/${propertyId}/units/${unitId}/options/${optionId}`, {
        method: 'DELETE', credentials: 'include',
      })
      await fetchData()
    } catch {
      setError('Failed to delete option')
    }
  }

  function startEditOption(unit: Unit, option: UnitOption) {
    setEditingOption({ unitId: unit.id, optionId: option.id })
    setOptionForm({
      name: option.name,
      pricePerSqm: option.pricePerSqm,
      currency: option.currency,
      initialPayment: option.initialPayment?.toString() || '',
      description: option.description || '',
    })
    setShowAddOption(unit.id)
  }

  const inputClass = 'w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 text-sm'
  const selectClass = 'w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 text-sm'
  const labelClass = 'block text-xs font-medium text-gray-600 mb-1'

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[#1B3A5C]" />
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/properties" className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wider font-medium">Project</div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-[#1B3A5C]" />
              {projectTitle}
            </h1>
          </div>
        </div>
        <button
          onClick={() => { setShowAddUnit(true); setEditingUnit(null); setUnitForm({ ...emptyUnit }) }}
          className="flex items-center gap-2 px-4 py-2 bg-[#1B3A5C] text-white rounded-lg hover:bg-[#162E4A] transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Add Unit
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
      )}

      {/* Add/Edit Unit Form */}
      {showAddUnit && (
        <div className="bg-white border border-blue-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-blue-700 mb-4">{editingUnit ? 'Edit Unit' : 'New Unit'}</h3>
          <form onSubmit={saveUnit} className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="col-span-2">
                <label className={labelClass}>Unit Name *</label>
                <input className={inputClass} value={unitForm.name} onChange={e => setUnitForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. 1BR Type A, 2BR Corner" required />
              </div>
              <div>
                <label className={labelClass}>Unit Number</label>
                <input className={inputClass} value={unitForm.unitNumber} onChange={e => setUnitForm(f => ({ ...f, unitNumber: e.target.value }))} placeholder="e.g. A101" />
              </div>
              <div>
                <label className={labelClass}>Status</label>
                <select className={selectClass} value={unitForm.availabilityStatus} onChange={e => setUnitForm(f => ({ ...f, availabilityStatus: e.target.value }))}>
                  {['AVAILABLE','RESERVED','SOLD','OFF_MARKET'].map(s => <option key={s} value={s}>{s.replace('_',' ')}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Bedrooms</label>
                <input className={inputClass} type="number" min="0" value={unitForm.bedrooms} onChange={e => setUnitForm(f => ({ ...f, bedrooms: Number(e.target.value) }))} />
              </div>
              <div>
                <label className={labelClass}>Bathrooms</label>
                <input className={inputClass} type="number" min="0" value={unitForm.bathrooms} onChange={e => setUnitForm(f => ({ ...f, bathrooms: Number(e.target.value) }))} />
              </div>
              <div>
                <label className={labelClass}>Area (m²) *</label>
                <input className={inputClass} type="number" min="1" step="0.1" value={unitForm.area || ''} onChange={e => setUnitForm(f => ({ ...f, area: Number(e.target.value) }))} required />
              </div>
              <div>
                <label className={labelClass}>Floor</label>
                <input className={inputClass} type="number" value={unitForm.floor} onChange={e => setUnitForm(f => ({ ...f, floor: e.target.value }))} placeholder="e.g. 5" />
              </div>
              <div>
                <label className={labelClass}>Parking Spaces</label>
                <input className={inputClass} type="number" min="0" value={unitForm.parkingSpaces} onChange={e => setUnitForm(f => ({ ...f, parkingSpaces: e.target.value }))} placeholder="0" />
              </div>
              <div className="col-span-2 md:col-span-3">
                <label className={labelClass}>Notes</label>
                <input className={inputClass} value={unitForm.notes} onChange={e => setUnitForm(f => ({ ...f, notes: e.target.value }))} placeholder="Additional notes" />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => { setShowAddUnit(false); setEditingUnit(null) }} className="px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">Cancel</button>
              <button type="submit" disabled={unitSaving} className="px-4 py-2 text-sm font-medium text-white bg-[#1B3A5C] hover:bg-[#162E4A] rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2">
                {unitSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingUnit ? 'Update Unit' : 'Create Unit'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Units list */}
      {units.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-xl p-12 text-center">
          <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-gray-600 font-medium mb-1">No units yet</h3>
          <p className="text-sm text-gray-400">Add the first unit to this project</p>
        </div>
      ) : (
        <div className="space-y-4">
          {units.map(unit => {
            const minOptionPrice = unit.options.length > 0
              ? Math.min(...unit.options.map(o => o.pricePerSqm * unit.area))
              : null

            return (
              <div key={unit.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                {/* Unit header */}
                <div className="flex items-center justify-between px-5 py-4 bg-gray-50 border-b border-gray-200">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="font-semibold text-gray-900">{unit.name}</h3>
                    {unit.unitNumber && <span className="text-xs bg-[#E0EDF7] text-[#1B3A5C] px-2 py-0.5 rounded font-mono">{unit.unitNumber}</span>}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${AVAILABILITY_COLORS[unit.availabilityStatus]}`}>
                      {unit.availabilityStatus.replace('_', ' ')}
                    </span>
                    <div className="flex items-center gap-3 text-sm text-gray-600">
                      <span className="flex items-center gap-1"><Bed className="w-3.5 h-3.5" />{unit.bedrooms}</span>
                      <span className="flex items-center gap-1"><Bath className="w-3.5 h-3.5" />{unit.bathrooms}</span>
                      <span className="flex items-center gap-1"><Maximize className="w-3.5 h-3.5" />{unit.area} m²</span>
                      {unit.floor && <span>Floor {unit.floor}</span>}
                    </div>
                    {minOptionPrice && (
                      <span className="text-sm font-semibold text-emerald-700 flex items-center gap-1">
                        <DollarSign className="w-3.5 h-3.5" />
                        From {new Intl.NumberFormat('en-US', { style: 'currency', currency: unit.options[0]?.currency || 'USD', maximumFractionDigits: 0 }).format(minOptionPrice)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => startEditUnit(unit)} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="Edit unit">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => deleteUnit(unit.id, unit.name)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Delete unit">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Options */}
                <div className="p-4 space-y-2">
                  {unit.options.length === 0 && (
                    <p className="text-sm text-gray-400 italic">No finish options yet</p>
                  )}
                  {unit.options.map(option => {
                    const totalPrice = option.pricePerSqm * unit.area
                    const fmtPrice = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: option.currency, maximumFractionDigits: 0 }).format(v)
                    const isEditingThisOption = editingOption?.optionId === option.id

                    return (
                      <div key={option.id}>
                        {isEditingThisOption && showAddOption === unit.id ? null : (
                          <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg border border-gray-100">
                            <div className="flex items-center gap-4 flex-wrap">
                              <span className="font-medium text-gray-900 text-sm">{option.name}</span>
                              <span className="text-sm text-gray-600">{fmtPrice(option.pricePerSqm)}/m²</span>
                              <span className="text-sm font-semibold text-[#1B3A5C]">{fmtPrice(totalPrice)} total</span>
                              {option.initialPayment && (
                                <span className="text-xs text-gray-500">Initial: {fmtPrice(option.initialPayment)}</span>
                              )}
                              {option.description && (
                                <span className="text-xs text-gray-400 italic">{option.description}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <button onClick={() => startEditOption(unit, option)} className="p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => deleteOption(unit.id, option.id, option.name)} className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {/* Add/Edit option form */}
                  {showAddOption === unit.id && (
                    <form onSubmit={e => saveOption(e, unit.id)} className="border border-blue-200 rounded-lg p-3 bg-blue-50/40 space-y-3 mt-2">
                      <div className="text-xs font-semibold text-blue-700 mb-2">{editingOption ? 'Edit Option' : 'Add Finish Option'}</div>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                        <div className="col-span-2">
                          <label className={labelClass}>Finish Type *</label>
                          <input
                            className={inputClass}
                            list={`presets-${unit.id}`}
                            value={optionForm.name}
                            onChange={e => setOptionForm(f => ({ ...f, name: e.target.value }))}
                            placeholder="e.g. Turnkey"
                            required
                          />
                          <datalist id={`presets-${unit.id}`}>
                            {FINISH_PRESETS.map(p => <option key={p} value={p} />)}
                          </datalist>
                        </div>
                        <div>
                          <label className={labelClass}>Price/m² *</label>
                          <input className={inputClass} type="number" min="0" step="0.01" value={optionForm.pricePerSqm || ''} onChange={e => setOptionForm(f => ({ ...f, pricePerSqm: Number(e.target.value) }))} required />
                        </div>
                        <div>
                          <label className={labelClass}>Currency</label>
                          <select className={selectClass} value={optionForm.currency} onChange={e => setOptionForm(f => ({ ...f, currency: e.target.value }))}>
                            {['USD','EUR','GBP','GEL'].map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className={labelClass}>Initial Payment</label>
                          <input className={inputClass} type="number" min="0" value={optionForm.initialPayment} onChange={e => setOptionForm(f => ({ ...f, initialPayment: e.target.value }))} placeholder="Optional" />
                        </div>
                        <div className="col-span-2 md:col-span-5">
                          <label className={labelClass}>Description</label>
                          <input className={inputClass} value={optionForm.description} onChange={e => setOptionForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional notes about this finish option" />
                        </div>
                        {optionForm.pricePerSqm > 0 && unit.area > 0 && (
                          <div className="col-span-2 md:col-span-5 text-sm text-emerald-700 font-medium">
                            Total price: {new Intl.NumberFormat('en-US', { style: 'currency', currency: optionForm.currency, maximumFractionDigits: 0 }).format(optionForm.pricePerSqm * unit.area)}
                            {' '}({optionForm.pricePerSqm}/m² &times; {unit.area} m²)
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button type="button" onClick={() => { setShowAddOption(null); setEditingOption(null); setOptionForm({ ...emptyOption }) }} className="px-3 py-1.5 text-xs text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">Cancel</button>
                        <button type="submit" disabled={optionSaving} className="px-3 py-1.5 text-xs font-medium text-white bg-[#1B3A5C] hover:bg-[#162E4A] rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1">
                          {optionSaving && <Loader2 className="w-3 h-3 animate-spin" />}
                          {editingOption ? 'Update' : 'Add Option'}
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Add option button */}
                  {showAddOption !== unit.id && (
                    <button
                      onClick={() => { setShowAddOption(unit.id); setEditingOption(null); setOptionForm({ ...emptyOption }) }}
                      className="flex items-center gap-1.5 text-xs text-[#1B3A5C] hover:text-[#C49A2E] font-medium mt-1 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add finish option
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
