import { prisma } from '@propgroup/db';

/**
 * How the chat assistant should behave, as the office sets it — kept in
 * SystemSetting so it changes from the back office, not from a deploy.
 *
 * The environment still holds the two things that must not be a click away:
 * the master switch (AUTO_REPLY_ENABLED) and the spend ceiling.
 */

const KEY = 'chat_ai_settings';

export interface PreferredProject {
  /** Reference code, e.g. "PG-1059". */
  ref: string;
  /** Why it is worth recommending — said to the client in their own language. */
  pitch: string;
}

export interface ChatAiSettings {
  /** Day-to-day on/off. The assistant also needs AUTO_REPLY_ENABLED=true. */
  enabled: boolean;
  /** Who it answers: only people from an ad or lead form, or everyone. */
  audience: 'ads' | 'all';
  /**
   * What to steer an undecided client towards, most wanted first. Used when
   * the ad or the client has not already named a project.
   */
  preferred: PreferredProject[];
  /**
   * How it writes to Arabic speakers.
   *   match        — the client's own language and script
   *   latin        — Lebanese Arabic in Latin letters ("kifak, shu badak?")
   *                  for anyone writing Arabic; English and French as they are
   *   latin_always — Lebanese in Latin letters to everyone
   */
  replyStyle: 'match' | 'latin' | 'latin_always';
  /** Anything else it should know or do, in the office's own words. */
  guidance: string;
}

export function defaultChatAiSettings(): ChatAiSettings {
  return {
    enabled: true,
    audience: process.env.AUTO_REPLY_AUDIENCE === 'all' ? 'all' : 'ads',
    preferred: [],
    replyStyle: 'latin',
    guidance: '',
  };
}

export async function getChatAiSettings(): Promise<ChatAiSettings> {
  const row = await prisma.systemSetting.findUnique({ where: { key: KEY } });
  const saved = (row?.value ?? {}) as Partial<ChatAiSettings>;
  const defaults = defaultChatAiSettings();
  return {
    enabled: typeof saved.enabled === 'boolean' ? saved.enabled : defaults.enabled,
    audience: saved.audience === 'all' || saved.audience === 'ads' ? saved.audience : defaults.audience,
    preferred: Array.isArray(saved.preferred)
      ? saved.preferred.filter((p) => p && typeof p.ref === 'string').map((p) => ({ ref: p.ref, pitch: p.pitch ?? '' }))
      : [],
    replyStyle:
      saved.replyStyle === 'match' || saved.replyStyle === 'latin' || saved.replyStyle === 'latin_always'
        ? saved.replyStyle
        : defaults.replyStyle,
    guidance: typeof saved.guidance === 'string' ? saved.guidance : '',
  };
}

export async function saveChatAiSettings(settings: ChatAiSettings, updatedBy?: string | null): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const value = settings as any;
  await prisma.systemSetting.upsert({
    where: { key: KEY },
    create: {
      key: KEY,
      value,
      category: 'ai',
      description: 'Chat assistant behaviour (WhatsApp / Instagram)',
      updatedBy: updatedBy ?? null,
    },
    update: { value, updatedBy: updatedBy ?? null },
  });
}
