'use client'

import { useState } from 'react'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Edit, Trash2, Eye, Shield, MoreHorizontal, Mail, Phone, Calendar,
  Ban, CheckCircle, Loader2, AlertTriangle,
} from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from '@/components/ui/use-toast'
import { normalizeApiUrl } from '@/lib/utils/api-url'

const API_BASE_URL = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL)

type User = {
  id: string
  email: string
  firstName?: string | null
  lastName?: string | null
  phone?: string | null
  country?: string | null
  role: string
  isActive?: boolean
  bannedAt?: string | null
  bannedReason?: string | null
  createdAt: string
  _count: {
    favoriteProperties: number
    propertyInquiries: number
    ownedProperties: number
  }
}

type UserTableProps = { users: User[] }

export function UserTable({ users: initialUsers }: UserTableProps) {
  const [users, setUsers] = useState(initialUsers)
  const [viewUser, setViewUser] = useState<User | null>(null)
  const [banUser, setBanUser] = useState<User | null>(null)
  const [deleteUser, setDeleteUser] = useState<User | null>(null)
  const [banReason, setBanReason] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN': return 'bg-purple-100 text-purple-800'
      case 'ADMIN': return 'bg-blue-100 text-blue-800'
      case 'AGENT': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const apiCall = async (url: string, options: RequestInit) => {
    const response = await fetch(url, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...options })
    const data = await response.json()
    if (!response.ok) throw new Error(data.message || data.error || 'Request failed')
    return data
  }

  const handleRoleChange = async (user: User, newRole: string) => {
    setIsLoading(true)
    try {
      await apiCall(`${API_BASE_URL}/api/users/${user.id}/role`, {
        method: 'PUT',
        body: JSON.stringify({ role: newRole }),
      })
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, role: newRole } : u))
      toast({ title: 'Role updated', description: `${user.email} is now ${newRole.replace('_', ' ')}` })
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setIsLoading(false)
    }
  }

  const handleBan = async () => {
    if (!banUser || !banReason.trim()) return
    setIsLoading(true)
    try {
      await apiCall(`${API_BASE_URL}/api/users/${banUser.id}/ban`, {
        method: 'POST',
        body: JSON.stringify({ reason: banReason }),
      })
      setUsers(prev => prev.map(u => u.id === banUser.id
        ? { ...u, isActive: false, bannedAt: new Date().toISOString(), bannedReason: banReason }
        : u
      ))
      toast({ title: 'User banned', description: `${banUser.email} has been banned` })
      setBanUser(null)
      setBanReason('')
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setIsLoading(false)
    }
  }

  const handleUnban = async (user: User) => {
    setIsLoading(true)
    try {
      await apiCall(`${API_BASE_URL}/api/users/${user.id}/unban`, { method: 'POST' })
      setUsers(prev => prev.map(u => u.id === user.id
        ? { ...u, isActive: true, bannedAt: null, bannedReason: null }
        : u
      ))
      toast({ title: 'User unbanned', description: `${user.email} has been unbanned` })
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteUser) return
    setIsLoading(true)
    try {
      await apiCall(`${API_BASE_URL}/api/users/${deleteUser.id}`, { method: 'DELETE' })
      setUsers(prev => prev.filter(u => u.id !== deleteUser.id))
      toast({ title: 'User deleted', description: `${deleteUser.email} has been removed` })
      setDeleteUser(null)
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setIsLoading(false)
    }
  }

  const displayName = (user: User) =>
    user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : 'No name provided'

  return (
    <>
      <div className="bg-white shadow rounded-lg">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Activity</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id} className={user.bannedAt ? 'opacity-60' : ''}>
                  <TableCell>
                    <div className="flex items-center space-x-3">
                      <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center">
                        <span className="text-sm font-medium text-gray-600">
                          {user.firstName?.charAt(0) || user.email.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <div className="font-medium text-gray-900">{displayName(user)}</div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="flex items-center text-sm text-gray-600">
                        <Mail className="h-4 w-4 mr-2" />{user.email}
                      </div>
                      {user.phone && (
                        <div className="flex items-center text-sm text-gray-600">
                          <Phone className="h-4 w-4 mr-2" />{user.phone}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={getRoleColor(user.role)}>
                      {(user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') && <Shield className="h-3 w-3 mr-1" />}
                      {user.role.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {user.bannedAt ? (
                      <Badge className="bg-red-100 text-red-800">
                        <Ban className="h-3 w-3 mr-1" />Banned
                      </Badge>
                    ) : (
                      <Badge className="bg-green-100 text-green-800">
                        <CheckCircle className="h-3 w-3 mr-1" />Active
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1 text-sm">
                      <div className="text-blue-600">{user._count.favoriteProperties} favorites</div>
                      <div className="text-green-600">{user._count.propertyInquiries} inquiries</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center text-sm text-gray-600">
                      <Calendar className="h-4 w-4 mr-2" />
                      {new Date(user.createdAt).toLocaleDateString()}
                    </div>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" aria-label="User actions">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setViewUser(user)}>
                          <Eye className="h-4 w-4 mr-2" />View Details
                        </DropdownMenuItem>
                        {user.role === 'USER' && (
                          <DropdownMenuItem onClick={() => handleRoleChange(user, 'ADMIN')}>
                            <Shield className="h-4 w-4 mr-2" />Make Admin
                          </DropdownMenuItem>
                        )}
                        {user.role === 'ADMIN' && (
                          <DropdownMenuItem onClick={() => handleRoleChange(user, 'USER')}>
                            <Shield className="h-4 w-4 mr-2" />Remove Admin
                          </DropdownMenuItem>
                        )}
                        {user.bannedAt ? (
                          <DropdownMenuItem onClick={() => handleUnban(user)}>
                            <CheckCircle className="h-4 w-4 mr-2" />Unban User
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => setBanUser(user)} className="text-orange-600">
                            <Ban className="h-4 w-4 mr-2" />Ban User
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => setDeleteUser(user)} className="text-red-600">
                          <Trash2 className="h-4 w-4 mr-2" />Delete User
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* View User Dialog */}
      <Dialog open={!!viewUser} onOpenChange={() => setViewUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
            <DialogDescription>{viewUser?.email}</DialogDescription>
          </DialogHeader>
          {viewUser && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-slate-500">Name:</span><p className="font-medium">{displayName(viewUser)}</p></div>
                <div><span className="text-slate-500">Role:</span><p><Badge className={getRoleColor(viewUser.role)}>{viewUser.role.replace('_', ' ')}</Badge></p></div>
                <div><span className="text-slate-500">Email:</span><p>{viewUser.email}</p></div>
                <div><span className="text-slate-500">Phone:</span><p>{viewUser.phone || 'N/A'}</p></div>
                <div><span className="text-slate-500">Country:</span><p className="capitalize">{viewUser.country?.toLowerCase() || 'N/A'}</p></div>
                <div><span className="text-slate-500">Joined:</span><p>{new Date(viewUser.createdAt).toLocaleDateString()}</p></div>
              </div>
              <div className="pt-2 border-t">
                <span className="text-slate-500">Activity:</span>
                <div className="flex gap-4 mt-1">
                  <span className="text-blue-600">{viewUser._count.favoriteProperties} favorites</span>
                  <span className="text-green-600">{viewUser._count.propertyInquiries} inquiries</span>
                  <span className="text-purple-600">{viewUser._count.ownedProperties} owned</span>
                </div>
              </div>
              {viewUser.bannedAt && (
                <div className="pt-2 border-t">
                  <Badge className="bg-red-100 text-red-800 mb-1"><Ban className="h-3 w-3 mr-1" />Banned</Badge>
                  {viewUser.bannedReason && <p className="text-slate-600">{viewUser.bannedReason}</p>}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Ban User Dialog */}
      <Dialog open={!!banUser} onOpenChange={() => { setBanUser(null); setBanReason('') }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-600">
              <AlertTriangle className="w-5 h-5" />Ban User
            </DialogTitle>
            <DialogDescription>
              This will prevent {banUser?.email} from accessing the platform.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Reason for ban <span className="text-red-500">*</span></Label>
              <Textarea value={banReason} onChange={(e) => setBanReason(e.target.value)} placeholder="Provide a reason..." rows={3} />
            </div>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => { setBanUser(null); setBanReason('') }}>Cancel</Button>
              <Button onClick={handleBan} disabled={!banReason.trim() || isLoading} className="bg-orange-600 hover:bg-orange-700 text-white">
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Ban className="w-4 h-4 mr-2" />}
                Ban User
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete User Dialog */}
      <Dialog open={!!deleteUser} onOpenChange={() => setDeleteUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />Delete User
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete {deleteUser?.email}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setDeleteUser(null)}>Cancel</Button>
            <Button onClick={handleDelete} disabled={isLoading} className="bg-red-600 hover:bg-red-700 text-white">
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Delete Permanently
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
