import { prisma } from '@propgroup/db';
import { logger } from './logger.js';
import { team } from '../services/assignment.service.js';

/**
 * One-time CRM data normalisations.
 *
 * Deployment runs `prisma db push`, which creates columns but never executes a
 * migration's data statements — so anything that has to *change existing rows*
 * has to run here instead. Each step is guarded by a marker in SystemSetting so
 * it runs exactly once, which matters: re-running would wipe follow-ups the
 * team has deliberately planned since.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

async function once(key: string, fn: () => Promise<string>): Promise<void> {
  const existing = await prisma.systemSetting.findUnique({ where: { key } });
  if (existing) return;
  const summary = await fn();
  await prisma.systemSetting.create({
    data: {
      key,
      value: { appliedAt: new Date().toISOString(), summary },
      category: 'migration',
      description: 'One-time CRM data normalisation (db push does not run migration SQL)',
    },
  });
  logger.info(`CRM bootstrap: ${key}`, { summary });
}

export async function normaliseCrmData(): Promise<void> {
  // The board no longer has a New column — an untouched client is just an
  // active one nobody has called yet.
  await once('crm_drop_new_status_v1', async () => {
    const { count } = await prisma.lead.updateMany({
      where: { status: 'NEW' as never },
      data: { status: 'ACTIVE' as never },
    });
    return `${count} leads moved from New to Active`;
  });

  // Sellers used to be described by one set of fields, which only ever fitted
  // one property. Give each existing seller a property row built from those
  // fields so nothing disappears when the UI switches to the new model.
  await once('crm_seed_seller_properties_v1', async () => {
    const sellers = await prisma.lead.findMany({
      where: {
        type: { in: ['SELLER', 'LANDLORD'] as never },
        status: { notIn: ['WON', 'LOST', 'ARCHIVED'] as never },
        properties: { none: {} },
      },
      select: {
        id: true, unitKinds: true, areas: true, regions: true, minBeds: true,
        budgetMin: true, budgetMax: true, currency: true, askingFor: true,
      },
    });
    if (sellers.length === 0) return 'no sellers to seed';
    await prisma.leadProperty.createMany({
      data: sellers.map((l: any) => ({
        leadId: l.id,
        kind: l.unitKinds?.[0] ?? 'APARTMENT',
        areas: l.areas ?? [],
        region: l.regions?.[0] ?? null,
        askingPrice: l.budgetMin ?? l.budgetMax ?? null,
        currency: l.currency,
        bedrooms: l.minBeds,
        notes: l.askingFor,
      })),
    });
    return `${sellers.length} seller properties seeded`;
  });

  // Everything we broker abroad is sold as a repeatable type — "1 bedroom" in
  // a development that many clients buy — rather than one specific apartment.
  // `db push` creates the column but never runs a migration's UPDATE, so the
  // backfill has to happen here.
  await once('crm_flag_international_unit_types_v1', async () => {
    const { count } = await prisma.unit.updateMany({
      where: { isUnitType: false, building: { country: { not: 'LEBANON' } } },
      data: { isUnitType: true },
    });
    return `${count} international units flagged as repeatable types`;
  });

  // An investor is a buyer with a motive, not a fifth kind of client. `db push`
  // creates the column but never runs a migration's UPDATE, so the fold happens
  // here. The INVESTOR enum value stays — Postgres can't drop one — but nothing
  // offers it any more.
  await once('crm_investor_is_a_flag_v1', async () => {
    const { count } = await prisma.lead.updateMany({
      where: { type: 'INVESTOR' as never },
      data: { type: 'BUYER' as never, isInvestor: true },
    });
    return `${count} investors folded into buyers`;
  });

  // A client can be selling and buying at once. Existing rows have one `type`;
  // seed the set from it so nothing has an empty intent list. `db push` adds
  // the column but never runs a migration's UPDATE.
  await once('crm_seed_lead_intents_v1', async () => {
    const leads = await prisma.lead.findMany({
      where: { intents: { isEmpty: true } },
      select: { id: true, type: true },
    });
    for (const l of leads) {
      await prisma.lead.update({
        where: { id: l.id },
        data: { intents: [l.type] as never },
      });
    }
    return `${leads.length} clients seeded with their intent`;
  });

  // Follow-up dates used to be invented from a 7-day cadence, so every imported
  // client showed up overdue on day one and the team stopped reading the badge.
  // Clear the invented ones; from here on a date only exists if someone set it.
  // The owner asked (2026-10-19) for Arabic letters to be answered in Arabic
  // letters, and voice notes in Lebanese in Latin letters — which is "match".
  // The old default answered every Arabic speaker in Latin letters.
  await once('chat_reply_style_match_v1', async () => {
    const row = await prisma.systemSetting.findUnique({ where: { key: 'chat_ai_settings' } });
    const value = (row?.value ?? null) as Record<string, unknown> | null;
    if (!row || !value || value.replyStyle !== 'latin') return 'nothing to change';
    await prisma.systemSetting.update({ where: { key: 'chat_ai_settings' }, data: { value: { ...value, replyStyle: 'match' } as never } });
    return 'chat assistant reply style moved from latin to match';
  });

  // Finishes used to carry their view as free text ("Sea view"). A finish whose
  // whole description is just a view becomes that view in the new field;
  // what follows a leading view ("Sea view, floors 8–15") stays as the note.
  await once('unit_option_views_from_text_v1', async () => {
    const VIEW_WORDS: Record<string, string> = { sea: 'SEA', mountain: 'MOUNTAIN', city: 'CITY', garden: 'GARDEN', pool: 'POOL', street: 'STREET', open: 'OPEN' };
    const options = await prisma.unitOption.findMany({ where: { description: { not: null } }, select: { id: true, description: true, views: true } });
    let moved = 0;
    for (const o of options) {
      if (o.views.length) continue;
      // "Sea view" → SEA, no note. "Sea view, floors 8–15" → SEA, note "floors 8–15".
      const text = (o.description ?? '').trim();
      const m = text.match(/^(sea|mountain|city|garden|pool|street|open)( view)?\s*(?:[,;:–—-]\s*(.+))?\.?$/i);
      if (!m) continue;
      const rest = m[3]?.trim() || null;
      await prisma.unitOption.update({ where: { id: o.id }, data: { views: [VIEW_WORDS[m[1].toLowerCase()]], description: rest } });
      moved++;
    }
    return `${moved} finish descriptions turned into a view`;
  });

  // Addresses lost to renames before Building.previousSlugs existed, seen
  // 404ing in the logs. Each is added only if nothing else uses it now.
  await once('previous_slugs_v1', async () => {
    const lost: Array<[string, string]> = [['tonino-lamborghini-tower-batumi', 'tonino-lamborghini-batumi']];
    let added = 0;
    for (const [current, old] of lost) {
      const taken = await prisma.building.findUnique({ where: { slug: old }, select: { id: true } });
      if (taken) continue;
      const r = await prisma.building.updateMany({ where: { slug: current }, data: { previousSlugs: { push: old } } });
      added += r.count;
    }
    return `${added} old addresses restored`;
  });

  // A finish now has one view from a short list, with its own price per m².
  // Multi-view rows take the view that sets the price, and a note that only named
  // a view ("Side Sea View") becomes that view. Any other note is left alone, and
  // a view the list dropped stays readable as a note rather than disappearing.
  await once('unit_option_one_view_v1', async () => {
    const options = await prisma.unitOption.findMany({ select: { id: true, description: true, views: true } });
    let changed = 0;
    for (const o of options) {
      const text = (o.description ?? '').trim();
      const onlyAView = text.length <= 40 && /views?\.?$/i.test(text);
      const said = [...o.views, ...(onlyAView || !o.views.length ? [text] : [])].join(' ');
      const view = /\bsea\b/i.test(said) ? 'SEA' : /\bmountains?\b/i.test(said) ? 'MOUNTAIN' : /\bprime\b/i.test(said) ? 'PRIME' : /\b(street|road)\b/i.test(said) ? 'ROAD' : null;
      const views = view ? [view] : [];
      const dropped = !view && o.views.length ? o.views.map((v) => v.charAt(0) + v.slice(1).toLowerCase()).join(' & ') + ' view' : null;
      const description = onlyAView && view ? null : text || dropped;
      if (o.views.join() === views.join() && (o.description ?? null) === (description || null)) continue;
      await prisma.unitOption.update({ where: { id: o.id }, data: { views, description: description || null } });
      changed++;
    }
    return `${changed} of ${options.length} finishes moved to one view`;
  });

  await once('crm_clear_derived_followups_v1', async () => {
    const { count } = await prisma.lead.updateMany({
      where: {
        nextContactAt: { not: null },
        status: { notIn: ['WON', 'LOST', 'ARCHIVED'] as never },
      },
      data: { nextContactAt: null },
    });
    return `${count} auto-generated follow-up dates cleared`;
  });

  // Sellers who offered a property in a chat before the assistant could file
  // it: give each an owner submission, so they are listed with the others.
  await once('chat_sellers_to_submissions_v1', async () => {
    const { savePropertyOffer } = await import('../services/chat-client-update.service.js');
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const sellers = await prisma.lead.findMany({
      where: {
        OR: [{ type: { in: ['SELLER', 'LANDLORD'] as never } }, { intents: { hasSome: ['SELLER', 'LANDLORD'] as never } }],
        conversations: { some: { lastMessageAt: { gte: since } } },
      },
      select: { id: true, type: true, askingFor: true, conversations: { orderBy: { lastMessageAt: 'desc' }, take: 1, select: { id: true } } },
    });
    let filed = 0;
    for (const lead of sellers) {
      const conversationId = lead.conversations[0]?.id;
      if (!conversationId) continue;
      if (await prisma.propertySubmission.findUnique({ where: { conversationId } })) continue;
      const done = await savePropertyOffer(conversationId, lead.id, {
        deal: lead.type === 'LANDLORD' ? 'RENT' : 'SALE',
        details: lead.askingFor ?? undefined,
      }).catch(() => null);
      if (done) filed++;
    }
    return `${filed} chat sellers filed as owner submissions`;
  });

  // "Not interested" used to leave the client's open deals on the board. Close
  // the ones it left behind, the way it does now.
  await once('lost_clients_close_open_deals_v1', async () => {
    const { count } = await prisma.leadOpportunity.updateMany({
      where: { lead: { status: 'LOST' as never }, stage: { notIn: ['WON', 'REJECTED'] as never } },
      data: { stage: 'REJECTED' as never, rejectionReason: 'CHANGED_MIND' as never },
    });
    return `${count} open deals of not-interested clients closed`;
  });

  // Accounting counts commission on the day it was received. Deals closed
  // before that was recorded were paid long ago: date them on their close, so
  // past profit does not show as money still owed.
  await once('commission_received_backfill_v1', async () => {
    const won = await prisma.leadOpportunity.findMany({
      where: { stage: 'WON' as never, commissionUsd: { not: null }, commissionReceivedAt: null },
      select: { id: true, closedAt: true, updatedAt: true },
    });
    for (const o of won) {
      await prisma.leadOpportunity.update({ where: { id: o.id }, data: { commissionReceivedAt: o.closedAt ?? o.updatedAt } });
    }
    return `${won.length} closed deals marked as paid on their closing date`;
  });
  // Clients had no owner before "assigned to" existed. Give each one to the
  // person who added them, or failing that whoever last logged a call or note
  // on them — so the board does not open with every card saying "Nobody".
  // Clients that arrived by themselves and nobody has touched stay unassigned:
  // that is true, and the "Nobody" filter is how they get picked up.
  await once('assign_existing_clients_v1', async () => {
    const people = (await team()).map((t) => t.id);
    if (people.length === 0) return 'no team members to assign to';

    let byCreator = 0;
    for (const id of people) {
      const { count } = await prisma.lead.updateMany({
        where: { assignees: { isEmpty: true }, createdBy: id },
        data: { assignees: [id] },
      });
      byCreator += count;
    }

    // Newest first, so the first row seen for a client is their latest contact.
    const logged = await prisma.leadContact.findMany({
      where: { createdBy: { in: people }, lead: { assignees: { isEmpty: true } } },
      orderBy: { contactedAt: 'desc' },
      select: { leadId: true, createdBy: true },
    });
    const latest = new Map<string, string>();
    for (const c of logged) if (c.createdBy && !latest.has(c.leadId)) latest.set(c.leadId, c.createdBy);
    for (const [leadId, userId] of latest) {
      await prisma.lead.updateMany({ where: { id: leadId, assignees: { isEmpty: true } }, data: { assignees: [userId] } });
    }

    const left = await prisma.lead.count({ where: { assignees: { isEmpty: true } } });
    return `${byCreator} assigned to who added them, ${latest.size} to who last contacted them, ${left} left unassigned`;
  });
}
