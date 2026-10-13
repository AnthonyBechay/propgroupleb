import { prisma } from '@propgroup/db';
import { syncLeadStatus } from '../routes/crm.js';
import { logger } from '../utils/logger.js';
import { projectsNamedIn, type Market } from './catalogue.service.js';

/**
 * Keeping the pipeline board in step with what happens in chat.
 *
 * The board is a pipeline of deals — one card per client × property. Chat is
 * where most of those begin: a client asks about a project from an ad
 * ("Enquiry"), or is sent a property ("Details sent"). Without this the board
 * only knew what somebody remembered to type in afterwards.
 *
 * A deal only ever moves FORWARD from here. A card somebody has already taken
 * to "Viewing booked" is never pulled back because the listing was sent again.
 */

type Stage = 'SUGGESTED' | 'SHARED';

async function ensureDeals(leadId: string, buildingIds: string[], stage: Stage, createdBy?: string | null): Promise<void> {
  const ids = [...new Set(buildingIds)].filter(Boolean);
  if (ids.length === 0) return;
  try {
    for (const buildingId of ids) {
      const existing = await prisma.leadOpportunity.findUnique({
        where: { leadId_buildingId: { leadId, buildingId } },
        select: { id: true, stage: true },
      });
      if (!existing) {
        await prisma.leadOpportunity.create({ data: { leadId, buildingId, stage, createdBy: createdBy ?? null } });
      } else if (existing.stage === 'SUGGESTED' && stage === 'SHARED') {
        await prisma.leadOpportunity.update({ where: { id: existing.id }, data: { stage } });
      }
    }
    await syncLeadStatus(leadId);
  } catch (err) {
    // The message has already gone to the client; a board that is one card
    // short is a nuisance, not a reason to report the send as failed.
    logger.error('Could not sync deals from chat', { leadId, error: (err as Error).message });
  }
}

/** Properties were sent to a client: each becomes (or advances to) "Details sent". */
export function recordListingsShared(leadId: string, buildingIds: string[], createdBy?: string | null): Promise<void> {
  return ensureDeals(leadId, buildingIds, 'SHARED', createdBy);
}

/** A client arrived from an ad that names a project: that is an "Enquiry" on it. */
export async function recordAdEnquiry(leadId: string, adText: string | null | undefined, market: Market): Promise<void> {
  try {
    const projects = await projectsNamedIn(adText, market);
    await ensureDeals(leadId, projects.map((p) => p.buildingId), 'SUGGESTED');
  } catch (err) {
    logger.error('Could not record ad enquiry', { leadId, error: (err as Error).message });
  }
}
