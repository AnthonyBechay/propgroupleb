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
