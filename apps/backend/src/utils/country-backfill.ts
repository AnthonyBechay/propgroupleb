import { prisma } from '@propgroup/db';
import { logger } from './logger.js';

/**
 * Copy each record's country from the old enum column into the free-text one.
 *
 * `country` was an enum of four countries; it is now free text, so a project
 * can be listed in Bulgaria or anywhere else without a code change. The deploy
 * syncs the schema with `prisma db push --accept-data-loss`, and that rewrites
 * an enum→text change as DROP COLUMN + ADD COLUMN: every project abroad would
 * have come back as LEBANON and appeared on the Lebanese site. So the text
 * column was added BESIDE the old one (`country_name`), where it starts out as
 * 'LEBANON' on every row, and this fills it in — once.
 *
 * Unlike the other boot routines this one is NOT allowed to fail quietly.
 * Until it has run, the new column says every project is in Lebanon, so the
 * caller must refuse to serve rather than show international stock on the
 * wrong site. The old container keeps running in the meantime.
 */
const KEY = 'country_free_text_v1';

export async function backfillCountryNames(): Promise<void> {
  if (await prisma.systemSetting.findUnique({ where: { key: KEY } })) return;

  const [buildings, guides, developers] = await prisma.$transaction([
    prisma.$executeRaw`UPDATE "buildings" SET "country_name" = "country"::text`,
    prisma.$executeRaw`UPDATE "location_guides" SET "country_name" = "country"::text`,
    prisma.$executeRaw`UPDATE "developers" SET "country_name" = "country"::text`,
    prisma.systemSetting.create({
      data: {
        key: KEY,
        value: { appliedAt: new Date().toISOString() },
        category: 'migration',
        description: 'Country copied from the old enum column to free text (db push does not run migration SQL)',
      },
    }),
  ]);
  logger.info('Countries copied to the free-text column', { buildings, guides, developers });
}
