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

export interface KnowledgeItem {
  /** What a client might ask, in the office's words. */
  question: string;
  /** How the office wants it answered. */
  answer: string;
}

export interface ChatAiSettings {
  /** Day-to-day on/off. The assistant also needs AUTO_REPLY_ENABLED=true. */
  enabled: boolean;
  /** Who it answers: only people from an ad or lead form, or everyone. */
  audience: 'ads' | 'all';
  /**
   * What happens when a person replies on a thread or the assistant hands over.
   *   step_aside         — it stays out until someone presses Resume
   *   return_after_quiet — it stays out, but once nobody from the team has
   *                        replied for `quietHours` and the client is waiting,
   *                        the assistant picks the conversation back up from
   *                        its summary
   *   always             — it keeps answering every thread regardless; only a
   *                        pause from the team stops it
   */
  handover: 'step_aside' | 'return_after_quiet' | 'always';
  /**
   * How long the team may stay silent before the assistant takes a waiting
   * client back. Under 24 hours on purpose: WhatsApp only allows a reply within
   * 24 hours of the client's last message, so a "full day" would always be too late.
   */
  quietHours: 1 | 3 | 6 | 12 | 20;
  /**
   * Which country a client means when no ad says so. "ask" puts the question
   * to them before anything is searched; otherwise that market is assumed.
   * (Someone from an ad is always taken to mean the ad's market.)
   */
  marketWhenUnknown: 'ask' | 'LEBANON' | 'GEORGIA';
  /**
   * The projects the office most wants to sell, most wanted first. They are
   * recommended first whenever they fit what the client asked for.
   */
  preferred: PreferredProject[];
  /** Most properties offered in one reply (each one lengthens the message). */
  maxListings: 1 | 2 | 3;
  /**
   * How it writes to Arabic speakers.
   *   match        — the client's own script: Arabic letters for Arabic
   *                  letters; Lebanese in Latin letters for Arabizi and for
   *                  Arabic voice notes; English and French as they are
   *   latin        — Lebanese Arabic in Latin letters ("kifak, shu badak?")
   *                  for anyone writing Arabic; English and French as they are
   *   latin_always — Lebanese in Latin letters to everyone
   */
  replyStyle: 'match' | 'latin' | 'latin_always';
  /**
   * quality — the stronger model first, about a cent a reply
   * economy — the cheapest model first, about a fifth of that; plainer replies
   */
  modelTier: 'quality' | 'economy';
  /** Where clients can visit, given when they ask for the address. */
  office: { name: string; address: string; mapsUrl: string };
  /** Questions the office has answered in advance. */
  knowledge: KnowledgeItem[];
  /** Anything else it should keep in mind, in the office's own words. */
  guidance: string;
}

export function defaultChatAiSettings(): ChatAiSettings {
  return {
    enabled: true,
    audience: process.env.AUTO_REPLY_AUDIENCE === 'all' ? 'all' : 'ads',
    marketWhenUnknown: 'ask',
    handover: 'return_after_quiet',
    quietHours: 6,
    preferred: [],
    maxListings: 3,
    replyStyle: 'match',
    modelTier: 'quality',
    office: { name: 'PropGroup', address: 'Fanar, Lebanon', mapsUrl: '' },
    knowledge: [],
    guidance: '',
  };
}

const oneOf = <T extends string | number>(value: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback;

export async function getChatAiSettings(): Promise<ChatAiSettings> {
  const row = await prisma.systemSetting.findUnique({ where: { key: KEY } });
  const saved = (row?.value ?? {}) as Partial<ChatAiSettings>;
  const d = defaultChatAiSettings();
  const office = (saved.office ?? {}) as Partial<ChatAiSettings['office']>;
  return {
    enabled: typeof saved.enabled === 'boolean' ? saved.enabled : d.enabled,
    audience: oneOf(saved.audience, ['ads', 'all'] as const, d.audience),
    marketWhenUnknown: oneOf(saved.marketWhenUnknown, ['ask', 'LEBANON', 'GEORGIA'] as const, d.marketWhenUnknown),
    handover: oneOf(saved.handover, ['step_aside', 'return_after_quiet', 'always'] as const, d.handover),
    quietHours: oneOf(saved.quietHours, [1, 3, 6, 12, 20] as const, d.quietHours),
    preferred: Array.isArray(saved.preferred)
      ? saved.preferred.filter((p) => p && typeof p.ref === 'string').map((p) => ({ ref: p.ref, pitch: p.pitch ?? '' }))
      : [],
    maxListings: oneOf(saved.maxListings, [1, 2, 3] as const, d.maxListings),
    replyStyle: oneOf(saved.replyStyle, ['match', 'latin', 'latin_always'] as const, d.replyStyle),
    modelTier: oneOf(saved.modelTier, ['quality', 'economy'] as const, d.modelTier),
    office: {
      name: typeof office.name === 'string' ? office.name : d.office.name,
      address: typeof office.address === 'string' ? office.address : d.office.address,
      mapsUrl: typeof office.mapsUrl === 'string' ? office.mapsUrl : d.office.mapsUrl,
    },
    knowledge: Array.isArray(saved.knowledge)
      ? saved.knowledge
          .filter((k) => k && typeof k.question === 'string' && typeof k.answer === 'string')
          .map((k) => ({ question: k.question, answer: k.answer }))
      : [],
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
