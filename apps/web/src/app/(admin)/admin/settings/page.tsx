'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useState } from 'react'
import {
  Settings as SettingsIcon,
  User,
  Bell,
  Shield,
  Database,
  Globe,
  Mail,
  Key,
  Palette,
  Save,
  Lock,
  AlertCircle,
  CheckCircle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

type TabType = 'profile' | 'security' | 'notifications' | 'email' | 'database' | 'api' | 'localization' | 'appearance'

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
  const [bio, setBio] = useState('')
  const [emailNotifications, setEmailNotifications] = useState(true)

  // Password form state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const isSuperAdmin = user?.role === 'SUPER_ADMIN'

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
    { id: 'profile' as TabType, label: 'Profile', icon: User, color: 'bg-[#1B3A5C]' },
    { id: 'security' as TabType, label: 'Security', icon: Lock, color: 'bg-emerald-600' },
    { id: 'notifications' as TabType, label: 'Notifications', icon: Bell, color: 'bg-[#C49A2E]' },
    { id: 'email' as TabType, label: 'Email Templates', icon: Mail, color: 'bg-slate-600' },
    ...(isSuperAdmin ? [
      { id: 'database' as TabType, label: 'Database', icon: Database, color: 'bg-amber-500' },
      { id: 'api' as TabType, label: 'API Keys', icon: Key, color: 'bg-rose-500' },
    ] : []),
    { id: 'localization' as TabType, label: 'Localization', icon: Globe, color: 'bg-indigo-600' },
    { id: 'appearance' as TabType, label: 'Appearance', icon: Palette, color: 'bg-teal-600' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
          <div className="w-10 h-10 bg-[#1B3A5C] rounded-xl flex items-center justify-center shadow-md">
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
                  <div className="w-8 h-8 bg-[#1B3A5C] rounded-lg flex items-center justify-center">
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
                      className="mt-2 border-2 border-slate-200 rounded-xl focus:border-[#1B3A5C] focus:ring-[#1B3A5C]"
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
                      className="mt-2 border-2 border-slate-200 rounded-xl focus:border-[#1B3A5C] focus:ring-[#1B3A5C]"
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
                      className="mt-2 border-2 border-slate-200 rounded-xl focus:border-[#1B3A5C] focus:ring-[#1B3A5C]"
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
                      className="mt-2 border-2 border-slate-200 rounded-xl focus:border-[#1B3A5C] focus:ring-[#1B3A5C]"
                      placeholder="United States"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <Label>Role</Label>
                    <div className="mt-2 flex items-center gap-3 p-4 bg-slate-50 rounded-xl border-2 border-slate-100">
                      <span className={`inline-flex items-center px-4 py-2 rounded-xl text-sm font-bold shadow-md
                        ${user?.role === 'SUPER_ADMIN'
                          ? 'bg-[#C49A2E] text-white'
                          : 'bg-[#1B3A5C] text-white'}`}>
                        <Shield className="h-4 w-4 mr-2" />
                        {user?.role?.replace('_', ' ') || 'USER'}
                      </span>
                      <span className="text-sm text-slate-600">
                        Your role determines your access level across the platform.
                      </span>
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <div className="flex items-start p-4 bg-slate-50 rounded-xl border-2 border-slate-100">
                      <div className="flex items-center h-5">
                        <input
                          id="notifications"
                          name="notifications"
                          type="checkbox"
                          checked={emailNotifications}
                          onChange={(e) => setEmailNotifications(e.target.checked)}
                          className="focus:ring-[#1B3A5C] h-5 w-5 text-[#1B3A5C] border-slate-300 rounded"
                        />
                      </div>
                      <div className="ml-3 text-sm">
                        <label htmlFor="notifications" className="font-bold text-slate-900">
                          Email Notifications
                        </label>
                        <p className="text-slate-600 mt-1">
                          Get notified about new inquiries, user registrations, and system updates.
                        </p>
                      </div>
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
                    className="bg-[#1B3A5C] hover:bg-[#152D4A] text-white rounded-xl font-bold shadow-md"
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

          {/* Other tabs placeholder */}
          {activeTab !== 'profile' && activeTab !== 'security' && (
            <div className="bg-white border-2 border-slate-100 shadow-lg rounded-2xl p-8 text-center">
              <div className="w-16 h-16 bg-slate-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <SettingsIcon className="h-8 w-8 text-slate-500" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Coming Soon</h3>
              <p className="text-slate-600">
                This section is under development and will be available soon.
              </p>
            </div>
          )}

          {isSuperAdmin && (
            <div className="mt-6 bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-200 rounded-2xl p-6 shadow-md">
              <h3 className="text-sm font-bold text-yellow-900 mb-2 flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Super Admin Access
              </h3>
              <p className="text-sm text-yellow-800">
                You have full system access. Additional settings for database management,
                API keys, and security configurations are available in the sidebar.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
