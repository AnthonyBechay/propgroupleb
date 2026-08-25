/**
 * Who may see and do what, in one place.
 *
 * These rules were previously written out inline at every call site — half a
 * dozen copies of `role === 'ADMIN' || role === 'SUPER_ADMIN'` — and the copies
 * had already drifted: the admin shell locked CRM_MANAGER out of the whole back
 * office, while the CRM page it was locked out of carefully hid commission from
 * it.
 *
 * Nothing here is a security boundary. The API enforces all of it (see
 * `middleware/auth.ts`); this module only decides what to render, so the UI
 * doesn't offer a door the server will slam.
 */

export type Role = 'USER' | 'AGENT' | 'CRM_MANAGER' | 'ADMIN' | 'SUPER_ADMIN'

/** Roles that get the admin shell at all. */
export const ADMIN_ROLES: readonly Role[] = ['CRM_MANAGER', 'ADMIN', 'SUPER_ADMIN']

/** Every role an admin can assign, in ascending order of power. */
export const ASSIGNABLE_ROLES: readonly Role[] = ['USER', 'AGENT', 'CRM_MANAGER', 'ADMIN', 'SUPER_ADMIN']

export const ROLE_LABELS: Record<Role, string> = {
  USER: 'User',
  AGENT: 'Agent',
  CRM_MANAGER: 'CRM Manager',
  ADMIN: 'Admin',
  SUPER_ADMIN: 'Super Admin',
}

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  USER: 'Public site and their own portal. No back office.',
  AGENT: 'Their own listings and inquiries.',
  CRM_MANAGER: 'The whole client pipeline — but never what the office earns.',
  ADMIN: 'The full back office, including commission figures.',
  SUPER_ADMIN: 'Everything, plus creating and managing users.',
}

export function canAccessAdmin(role: string | null | undefined): boolean {
  return ADMIN_ROLES.includes(role as Role)
}

export function isSuperAdmin(role: string | null | undefined): boolean {
  return role === 'SUPER_ADMIN'
}

/**
 * May this role see what the office earns?
 *
 * The single question the CRM_MANAGER role exists to answer "no" to. Mirrors
 * `canSeeMoney` in the backend middleware — keep the two in step.
 */
export function canSeeMoney(role: string | null | undefined): boolean {
  return role === 'ADMIN' || role === 'SUPER_ADMIN'
}

/**
 * The admin routes a CRM_MANAGER may open.
 *
 * Deliberately a prefix allow-list rather than a deny-list: a page added next
 * month is invisible to the restricted role until somebody decides otherwise,
 * which is the failure direction we want. Every other admin endpoint answers
 * 403 to this role anyway, so the pages would render empty at best.
 */
const CRM_MANAGER_PATHS = ['/admin/crm']

/** Where a role lands when it opens the back office. */
export function adminHomeFor(role: string | null | undefined): string {
  return role === 'CRM_MANAGER' ? '/admin/crm' : '/admin'
}

export function canAccessAdminPath(role: string | null | undefined, pathname: string): boolean {
  if (!canAccessAdmin(role)) return false
  if (role !== 'CRM_MANAGER') return true
  return CRM_MANAGER_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}
