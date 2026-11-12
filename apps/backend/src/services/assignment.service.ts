import { prisma } from '@propgroup/db';

/**
 * Whose client is this?
 *
 * A client can be looked after by one person or several. Nobody had to be
 * before, which in an office of three meant everyone assumed somebody else was
 * answering. Assignment never hides anything: the board still shows every
 * client to everyone, with a name on each card.
 */

/** The people who can be given a client: anyone who works the CRM. */
export async function team(): Promise<Array<{ id: string; name: string; initials: string }>> {
  const users = await prisma.user.findMany({
    where: { isActive: true, role: { in: ['CRM_MANAGER', 'ADMIN', 'SUPER_ADMIN'] } },
    select: { id: true, firstName: true, lastName: true, email: true },
    orderBy: [{ firstName: 'asc' }, { createdAt: 'asc' }],
  });
  return users.map((u) => {
    const name = [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.email.split('@')[0];
    const parts = name.split(/[\s._-]+/).filter(Boolean);
    const initials = ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : parts[0]?.[1] ?? '')).toUpperCase();
    return { id: u.id, name, initials };
  });
}

/** Keep only ids that are real team members. */
export async function validAssignees(ids: string[]): Promise<string[]> {
  const known = new Set((await team()).map((t) => t.id));
  return Array.from(new Set(ids)).filter((id) => known.has(id));
}

/**
 * Whoever picks a client up owns them — if nobody does yet.
 *
 * Called when somebody replies to a client, books them or adds them. It never
 * takes a client away from a colleague: it only fills an empty seat.
 */
export async function claimIfUnassigned(leadId: string | null | undefined, userId: string | null | undefined): Promise<void> {
  if (!leadId || !userId) return;
  await prisma.lead
    .updateMany({ where: { id: leadId, assignees: { isEmpty: true } }, data: { assignees: [userId] } })
    .catch(() => {});
}
