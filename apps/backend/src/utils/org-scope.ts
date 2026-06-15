import { prisma } from '@propgroup/db';
import type { AuthenticatedRequest } from '../types/index.js';

/**
 * Multi-tenant scope for property-management data.
 *
 * Platform staff (SUPER_ADMIN / ADMIN) see everything (`all = true`).
 * Org members (PROPERTY_MANAGER etc.) are scoped to the buildings owned by the
 * organizations they belong to. A user with no org sees nothing (empty arrays).
 *
 * All PM data hangs off a building (units.buildingId, tickets.buildingId,
 * tenancy → unit → building), so a building-id allowlist is enough to isolate
 * one company's data from another's.
 */
export interface OrgScope {
  all: boolean;
  buildingIds: string[];
  orgIds: string[];
}

export async function getOrgScope(user: AuthenticatedRequest['user']): Promise<OrgScope> {
  if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') {
    return { all: true, buildingIds: [], orgIds: [] };
  }
  const memberships = await prisma.organizationMember.findMany({
    where: { userId: user.id, isActive: true },
    select: { organizationId: true },
  });
  const orgIds = memberships.map((m) => m.organizationId);
  if (orgIds.length === 0) return { all: false, buildingIds: [], orgIds: [] };

  const buildings = await prisma.building.findMany({
    where: { organizationId: { in: orgIds } },
    select: { id: true },
  });
  return { all: false, buildingIds: buildings.map((b) => b.id), orgIds };
}

/**
 * A Prisma `where` fragment for a model that has a direct `buildingId` column.
 * Returns `{}` for platform staff (no restriction). For scoped users it limits
 * to their building allowlist (an impossible match when they have none).
 */
export function buildingScopeWhere(scope: OrgScope): Record<string, unknown> {
  if (scope.all) return {};
  return { buildingId: { in: scope.buildingIds } };
}
