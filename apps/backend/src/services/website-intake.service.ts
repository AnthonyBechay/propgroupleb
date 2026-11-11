import { prisma } from '@propgroup/db';
import { logger } from '../utils/logger.js';
import { findLeadByPhone, normalisePhone } from './messaging-intake.service.js';
import { recordWebsiteEnquiry } from './deal-sync.service.js';
import { normalizeRef } from '../utils/reference.js';

/**
 * Website forms → the pipeline.
 *
 * A WhatsApp chat from an ad and a Facebook lead form both became a client by
 * themselves. A form on our own two websites did not: it was stored as a
 * `ContactMessage` or a `PropertyInquiry` and waited for somebody to open that
 * screen and press "Add to CRM" (and a contact message had no such button at
 * all). So the visitors search engines send us — the cheapest leads we get —
 * were the only ones that could be missed, and the same person writing on
 * WhatsApp afterwards started a second, unrelated record.
 *
 * The board already expected them: `INQUIRY` is one of its inbound sources and
 * shows as "Enquiry — nobody has contacted them" under To answer.
 *
 * Same rules as the lead-form intake: one client per person (matched on phone,
 * then email), a repeat enquiry is a note on their timeline, and nothing here
 * may fail the form — the message itself is already saved by the caller.
 */

export interface WebsiteEnquiry {
  name: string;
  email?: string | null;
  phone?: string | null;
  message?: string | null;
  subject?: string | null;
  /** Which site it was sent from. */
  site: 'LEBANON' | 'INTERNATIONAL';
  /** The property asked about, when the form was on a property page. */
  buildingId?: string | null;
  /** "contact form" or "property enquiry" — said on the timeline note. */
  kind: string;
}

/** `PG-1042` out of "Project enquiry: PG-1042 — Tonino Residence". */
function refIn(text: string | null | undefined): string | null {
  const hit = text?.match(/\bPG[-\s]?\d{3,6}\b/i);
  return hit ? normalizeRef(hit[0]) : null;
}

export async function upsertLeadFromWebsite(input: WebsiteEnquiry): Promise<void> {
  try {
    // The Georgia site forwards a property enquiry as a contact message whose
    // subject carries the reference code; that is the only link to the project.
    let building = input.buildingId
      ? await prisma.building.findUnique({
          where: { id: input.buildingId },
          select: { id: true, title: true, ref: true, country: true, city: true, neighborhood: true },
        })
      : null;
    if (!building) {
      const ref = refIn(input.subject) ?? refIn(input.message);
      if (ref) {
        building = await prisma.building.findUnique({
          where: { ref },
          select: { id: true, title: true, ref: true, country: true, city: true, neighborhood: true },
        });
      }
    }

    const digits = normalisePhone(input.phone);
    const email = input.email?.trim().toLowerCase() || null;
    const existing =
      (digits ? await findLeadByPhone(digits) : null) ??
      (email ? await prisma.lead.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } }) : null);

    const about = building ? [building.ref, building.title].filter(Boolean).join(' — ') : input.subject?.trim() || null;
    const said = [about && `About: ${about}`, input.message?.trim()].filter(Boolean).join('\n');

    let leadId: string;
    if (existing) {
      leadId = existing.id;
      await prisma.leadContact.create({
        data: {
          leadId,
          channel: 'NOTE',
          body: `Website ${input.kind}\n${said}`.slice(0, 4000),
          outcome: 'Inbound',
        },
      });
      // They wrote to us again: no longer "waiting on them", and someone
      // parked or lost who comes back is a live client again.
      await prisma.lead.updateMany({
        where: { id: leadId, subStatus: 'AWAITING_REPLY' },
        data: { subStatus: null },
      });
      await prisma.lead.updateMany({
        where: { id: leadId, status: { in: ['ARCHIVED', 'LOST'] } },
        data: { status: 'ACTIVE', subStatus: null, closedAt: null },
      });
      // Fill in what we did not have; never overwrite what the team typed.
      await prisma.lead.update({
        where: { id: leadId },
        data: {
          ...(!existing.email && email ? { email } : {}),
          ...(!existing.phone && input.phone ? { phone: input.phone } : {}),
        },
      });
    } else {
      // The property's own country wins over the site it was sent from.
      const abroad = building ? building.country !== 'LEBANON' : input.site === 'INTERNATIONAL';
      const lead = await prisma.lead.create({
        data: {
          market: abroad ? 'INTERNATIONAL' : 'LEBANON',
          type: 'BUYER',
          isInvestor: abroad,
          status: 'ACTIVE',
          source: 'INQUIRY',
          name: input.name.trim(),
          phone: input.phone || null,
          whatsapp: input.phone || null,
          email,
          askingFor: about ? `Enquired about ${about}`.slice(0, 200) : null,
          notes: said || null,
          // They contacted us and nobody has replied: lastContactAt stays null
          // so the card reads "nobody has contacted them".
          contactIntervalDays: 3,
        },
      });
      leadId = lead.id;
      logger.info('Client auto-created from website form', { leadId, site: input.site, kind: input.kind });
    }

    if (building) await recordWebsiteEnquiry(leadId, building.id);
  } catch (err) {
    // The enquiry itself is stored and emailed by the caller. Missing from the
    // board is a nuisance somebody will notice; a failed form loses the lead.
    logger.error('Website enquiry not added to the CRM', { error: (err as Error).message });
  }
}
