import { prisma } from '@propgroup/db';
import { logger } from './logger.js';

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
}
