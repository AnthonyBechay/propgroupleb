'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useState, useEffect, useRef } from 'react'
import { normalizeApiUrl } from '@/lib/utils/api-url'
import {
  Settings as SettingsIcon,
  User,
  Shield,
  Palette,
  Save,
  Lock,
  AlertCircle,
  CheckCircle,
  Upload,
  Image as ImageIcon,
  X,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type TabType = 'profile' | 'security' | 'appearance'

export default function SettingsPage() {
  const { user, updateProfile, changePassword } = useAuth()
  const [activeTab, setActiveTab] = useState<TabType>('profile')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  // Profile form state
  const [firstName, setFirstName] = useState(user?.firstName || '')
  const [lastName, setLastName] = useState(user?.lastName || '')
  const [phone, setPhone] = useState(user?.phone || '')
  const [country, setCountry] = useState(user?.country || '')

  // Password form state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // Branding state
  const [logoUrl, setLogoUrl] = useState('')
  const [logoUploading, setLogoUploading] = useState(false)
  const [logoSaving, setLogoSaving] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)

  // Load branding settings on mount
  useEffect(() => {
    const loadBranding = async () => {
      try {
        const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
        const res = await fetch(`${apiUrl}/api/content/media/branding.logoUrl`)
        if (res.ok) {
          const data = await res.json()
          setLogoUrl(data.data?.url || data.url || '')
        }
      } catch {}
    }
    loadBranding()
  }, [])

  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoUploading(true)
    try {
      const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
      const fd = new FormData()
      fd.append('file', file)
      fd.append('folder', 'branding')
      const res = await fetch(`${apiUrl}/api/upload`, { method: 'POST', credentials: 'include', body: fd })
      if (res.ok) {
        const data = await res.json()
        setLogoUrl(data.url || data.data?.url || '')
      } else {
        setMessage({ type: 'error', text: 'Failed to upload logo image' })
      }
    } catch {
      setMessage({ type: 'error', text: 'Upload error. Please try again.' })
    } finally {
      setLogoUploading(false)
      if (logoInputRef.current) logoInputRef.current.value = ''
    }
  }

  const handleSaveBranding = async () => {
    setLogoSaving(true)
    setMessage(null)
    try {
      const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
      const res = await fetch(`${apiUrl}/api/content/media/branding.logoUrl`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: logoUrl || '', section: 'branding', alt: 'Company Logo' }),
      })
      if (res.ok) {
        setMessage({ type: 'success', text: 'Branding settings saved!' })
      } else {
        const err = await res.json().catch(() => ({}))
        setMessage({ type: 'error', text: err.message || 'Failed to save branding settings' })
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to save settings. Please try again.' })
    } finally {
      setLogoSaving(false)
    }
  }

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    try {
      const result = await updateProfile({
        firstName,
        lastName,
        phone,
        country,
      })

      if (result.error) {
        setMessage({ type: 'error', text: result.error })
      } else {
        setMessage({ type: 'success', text: 'Profile updated successfully!' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update profile' })
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'New passwords do not match' })
      setLoading(false)
      return
    }

    if (newPassword.length < 8) {
      setMessage({ type: 'error', text: 'Password must be at least 8 characters long' })
      setLoading(false)
      return
    }

    try {
      const result = await changePassword(currentPassword, newPassword)

      if (result.error) {
        setMessage({ type: 'error', text: result.error })
      } else {
        setMessage({ type: 'success', text: 'Password changed successfully!' })
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to change password' })
    } finally {
      setLoading(false)
    }
  }

  const navItems = [
    { id: 'profile' as TabType, label: 'Profile', icon: User, color: 'bg-slate-800' },
    { id: 'security' as TabType, label: 'Security', icon: Lock, color: 'bg-emerald-600' },
    { id: 'appearance' as TabType, label: 'Appearance', icon: Palette, color: 'bg-teal-600' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center shadow-md">
            <SettingsIcon className="h-6 w-6 text-white" />
          </div>
          Settings
        </h1>
        <p className="mt-2 text-slate-600">
          Manage your platform settings and preferences.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {/* Left Sidebar */}
        <div className="lg:col-span-1">
          <nav className="space-y-2 bg-white border-2 border-slate-100 rounded-2xl p-4 shadow-lg">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`group flex items-center px-4 py-3 text-sm font-bold rounded-xl w-full transition-all ${
                  activeTab === item.id
                    ? `${item.color} text-white shadow-md`
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <item.icon className={`flex-shrink-0 mr-3 h-5 w-5 ${
                  activeTab === item.id ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'
                }`} />
                <span className="truncate">{item.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3">
          {/* Message Alert */}
          {message && (
            <div className={`mb-6 p-4 rounded-xl border-2 flex items-center gap-3 ${
              message.type === 'success'
                ? 'bg-green-50 border-green-200 text-green-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}>
              {message.type === 'success' ? (
                <CheckCircle className="h-5 w-5 flex-shrink-0" />
              ) : (
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
              )}
              <span className="font-medium">{message.text}</span>
            </div>
          )}

          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div className="bg-white border-2 border-slate-100 shadow-lg rounded-2xl overflow-hidden">
              <div className="px-6 py-5 border-b-2 border-slate-100 bg-gradient-to-r from-slate-50 to-white">
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center">
                    <User className="h-5 w-5 text-white" />
                  </div>
                  Profile Settings
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Update your personal information and account details.
                </p>
              </div>

              <form onSubmit={handleProfileSubmit} className="p-6 space-y-6">
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="firstName" className="font-bold text-slate-900">First Name</Label>
                    <Input
                      type="text"
                      id="firstName"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="mt-2 border-2 border-slate-200 rounded-xl focus:border-slate-800 focus:ring-slate-800"
                      placeholder="Enter first name"
                    />
                  </div>

                  <div>
                    <Label htmlFor="lastName" className="font-bold text-slate-900">Last Name</Label>
                    <Input
                      type="text"
                      id="lastName"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="mt-2 border-2 border-slate-200 rounded-xl focus:border-slate-800 focus:ring-slate-800"
                      placeholder="Enter last name"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <Label htmlFor="email" className="font-bold text-slate-900">Email Address</Label>
                    <Input
                      type="email"
                      id="email"
                      value={user?.email || ''}
                      className="mt-2 border-2 border-slate-200 rounded-xl bg-slate-50"
                      disabled
                    />
                    <p className="mt-2 text-sm text-slate-500 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      Email cannot be changed. Contact support if needed.
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="phone" className="font-bold text-slate-900">Phone Number</Label>
                    <Input
                      type="tel"
                      id="phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="mt-2 border-2 border-slate-200 rounded-xl focus:border-slate-800 focus:ring-slate-800"
                      placeholder="+961 71 000 000"
                    />
                  </div>

                  <div>
                    <Label htmlFor="country" className="font-bold text-slate-900">Country</Label>
                    <Input
                      type="text"
                      id="country"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="mt-2 border-2 border-slate-200 rounded-xl focus:border-slate-800 focus:ring-slate-800"
                      placeholder="United States"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <Label>Role</Label>
                    <div className="mt-2 flex items-center gap-3 p-4 bg-slate-50 rounded-xl border-2 border-slate-100">
                      <span className={`inline-flex items-center px-4 py-2 rounded-xl text-sm font-bold shadow-md
                        ${user?.role === 'SUPER_ADMIN'
                          ? 'bg-amber-700 text-white'
                          : 'bg-slate-800 text-white'}`}>
                        <Shield className="h-4 w-4 mr-2" />
                        {user?.role?.replace('_', ' ') || 'USER'}
                      </span>
                      <span className="text-sm text-slate-600">
                        Your role determines your access level across the platform.
                      </span>
                    </div>
                  </div>

                </div>

                <div className="flex justify-end gap-3 pt-4 border-t-2 border-slate-100">
                  <Button
                    type="button"
                    variant="outline"
                    className="border-2 border-slate-300 rounded-xl font-bold"
                    onClick={() => {
                      setFirstName(user?.firstName || '')
                      setLastName(user?.lastName || '')
                      setPhone(user?.phone || '')
                      setCountry(user?.country || '')
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={loading}
                    className="bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold shadow-md"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {loading ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* Security Tab */}
          {activeTab === 'security' && (
            <div className="bg-white border-2 border-slate-100 shadow-lg rounded-2xl overflow-hidden">
              <div className="px-6 py-5 border-b-2 border-slate-100 bg-gradient-to-r from-slate-50 to-white">
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
                    <Lock className="h-5 w-5 text-white" />
                  </div>
                  Security Settings
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Update your password and security preferences.
                </p>
              </div>

              <form onSubmit={handlePasswordSubmit} className="p-6 space-y-6">
                <div className="space-y-6">
                  <div>
                    <Label htmlFor="currentPassword" className="font-bold text-slate-900">Current Password</Label>
                    <Input
                      type="password"
                      id="currentPassword"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="mt-2 border-2 border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-emerald-500"
                      placeholder="Enter current password"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="newPassword" className="font-bold text-slate-900">New Password</Label>
                    <Input
                      type="password"
                      id="newPassword"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="mt-2 border-2 border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-emerald-500"
                      placeholder="Enter new password"
                      required
                    />
                    <p className="mt-2 text-sm text-slate-500">
                      Password must be at least 8 characters long.
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="confirmPassword" className="font-bold text-slate-900">Confirm New Password</Label>
                    <Input
                      type="password"
                      id="confirmPassword"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="mt-2 border-2 border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-emerald-500"
                      placeholder="Confirm new password"
                      required
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t-2 border-slate-100">
                  <Button
                    type="button"
                    variant="outline"
                    className="border-2 border-slate-300 rounded-xl font-bold"
                    onClick={() => {
                      setCurrentPassword('')
                      setNewPassword('')
                      setConfirmPassword('')
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={loading}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-md"
                  >
                    <Lock className="h-4 w-4 mr-2" />
                    {loading ? 'Updating...' : 'Change Password'}
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* Appearance Tab */}
          {activeTab === 'appearance' && (
            <div className="bg-white border-2 border-slate-100 shadow-lg rounded-2xl overflow-hidden">
              <div className="px-6 py-5 border-b-2 border-slate-100 bg-gradient-to-r from-slate-50 to-white">
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <div className="w-8 h-8 bg-teal-600 rounded-lg flex items-center justify-center">
                    <Palette className="h-5 w-5 text-white" />
                  </div>
                  Branding &amp; Appearance
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Configure your logo and brand assets used across the platform and exported documents.
                </p>
              </div>

              <div className="p-6 space-y-6">
                {/* Logo */}
                <div>
                  <Label className="font-bold text-slate-900 mb-3 block">Company Logo</Label>
                  <p className="text-sm text-slate-500 mb-4">
                    Displayed on exported property sheets and investor documents. Recommended: PNG with transparent background, min 200px wide.
                  </p>

                  {/* Current logo preview */}
                  {logoUrl && (
                    <div className="mb-4 flex items-start gap-4 p-4 bg-slate-50 rounded-xl border-2 border-slate-100">
                      <div className="w-32 h-16 rounded-lg bg-white border border-slate-200 flex items-center justify-center overflow-hidden flex-shrink-0 p-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={logoUrl} alt="Company logo" className="max-w-full max-h-full object-contain" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">Current logo</p>
                        <p className="text-xs text-slate-500 truncate mt-0.5">{logoUrl}</p>
                        <button
                          onClick={() => setLogoUrl('')}
                          className="mt-2 text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
                        >
                          <X className="w-3 h-3" /> Remove logo
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Upload new logo */}
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-medium text-slate-700 mb-2">Upload new logo</p>
                      <div
                        className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center hover:border-teal-400 transition-colors cursor-pointer"
                        onClick={() => logoInputRef.current?.click()}
                      >
                        {logoUploading ? (
                          <div className="flex flex-col items-center gap-2">
                            <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
                            <p className="text-sm text-slate-500">Uploading...</p>
                          </div>
                        ) : (
                          <>
                            <ImageIcon className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                            <p className="text-sm text-slate-500">Click to upload PNG, JPG, SVG, or WebP</p>
                            <p className="text-xs text-slate-400 mt-1">Recommended: transparent background PNG</p>
                          </>
                        )}
                        <input
                          ref={logoInputRef}
                          type="file"
                          className="hidden"
                          accept=".png,.jpg,.jpeg,.webp,.svg"
                          onChange={handleLogoFileChange}
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-px bg-slate-200" />
                      <span className="text-xs text-slate-400 font-medium">or enter URL directly</span>
                      <div className="flex-1 h-px bg-slate-200" />
                    </div>

                    <div>
                      <Label htmlFor="logoUrl" className="text-sm font-medium text-slate-700 mb-1.5 block">Logo URL</Label>
                      <Input
                        id="logoUrl"
                        type="url"
                        value={logoUrl}
                        onChange={(e) => setLogoUrl(e.target.value)}
                        placeholder="https://your-cdn.com/logo.png"
                        className="border-2 border-slate-200 rounded-xl"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t-2 border-slate-100">
                  <Button
                    type="button"
                    onClick={handleSaveBranding}
                    disabled={logoSaving}
                    className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold shadow-md"
                  >
                    {logoSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save Branding
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
