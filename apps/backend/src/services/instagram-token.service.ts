import { prisma } from '@propgroup/db';
import { logger } from '../utils/logger.js';

/**
 * Keeping the Instagram token alive.
 *
 * The account token from the Meta app expires 60 days after it is issued, and
 * replying on Instagram stops when it does — silently, from the client's side.
 * Meta lets a long-lived token be exchanged for a fresh 60-day one any time
 * after it is a day old, so the server does that itself every week and keeps
 * the newest token in the database. INSTAGRAM_ACCESS_TOKEN is only the seed.
 *
 * If the token in Coolify is ever replaced by hand (a new account, a revoked
 * one), the newer of the two is used.
 */

const KEY = 'instagram_access_token';
const GRAPH = 'https://graph.instagram.com';
/** Well inside the 60 days, and well past Meta's "at least a day old" rule. */
const REFRESH_AFTER_MS = 7 * 24 * 60 * 60 * 1000;
const CHECK_EVERY_MS = 12 * 60 * 60 * 1000;

interface Stored {
  token: string;
  /** The env token this one descends from, to notice when it is replaced by hand. */
  seed: string;
  refreshedAt: string;
  expiresAt: string | null;
}

let current: string | null = process.env.INSTAGRAM_ACCESS_TOKEN || null;
let status: { refreshedAt: string | null; expiresAt: string | null; error: string | null } = {
  refreshedAt: null,
  expiresAt: null,
  error: null,
};

/** The token to call Instagram with right now. */
export function instagramToken(): string | null {
  return current;
}

/** For the settings page: when it was last renewed and until when it is good. */
export function instagramTokenStatus() {
  return { ...status, configured: Boolean(current) };
}

async function load(): Promise<Stored | null> {
  const row = await prisma.systemSetting.findUnique({ where: { key: KEY } });
  return (row?.value as unknown as Stored) ?? null;
}

async function save(stored: Stored): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const value = stored as any;
  await prisma.systemSetting.upsert({
    where: { key: KEY },
    create: { key: KEY, value, category: 'integration', description: 'Instagram account token, renewed automatically' },
    update: { value },
  });
}

async function refreshIfDue(): Promise<void> {
  const seed = process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!seed) return;

  let stored = await load();
  // A different token put in Coolify by hand wins over what the server kept.
  if (!stored || stored.seed !== seed) {
    stored = { token: seed, seed, refreshedAt: new Date(0).toISOString(), expiresAt: null };
  }
  current = stored.token;
  status = { refreshedAt: stored.refreshedAt === new Date(0).toISOString() ? null : stored.refreshedAt, expiresAt: stored.expiresAt, error: null };

  if (Date.now() - new Date(stored.refreshedAt).getTime() < REFRESH_AFTER_MS) return;

  try {
    const params = new URLSearchParams({ grant_type: 'ig_refresh_token', access_token: stored.token });
    // The token travels in the query string because that is the only form this
    // endpoint takes; the URL is never logged.
    const res = await fetch(`${GRAPH}/refresh_access_token?${params}`, { signal: AbortSignal.timeout(15_000) });
    const json = (await res.json().catch(() => ({}))) as {
      access_token?: string;
      expires_in?: number;
      error?: { message?: string };
    };
    if (!res.ok || !json.access_token) throw new Error(json.error?.message ?? `HTTP ${res.status}`);

    const now = new Date();
    const next: Stored = {
      token: json.access_token,
      seed,
      refreshedAt: now.toISOString(),
      expiresAt: json.expires_in ? new Date(now.getTime() + json.expires_in * 1000).toISOString() : null,
    };
    await save(next);
    current = next.token;
    status = { refreshedAt: next.refreshedAt, expiresAt: next.expiresAt, error: null };
    logger.info('Instagram token renewed', { expiresAt: next.expiresAt });
  } catch (err) {
    status = { ...status, error: (err as Error).message };
    logger.error('Instagram token could not be renewed', err, {
      hint: 'Generate a new token in the Meta app and put it in INSTAGRAM_ACCESS_TOKEN',
    });
  }
}

/** Renew on boot if due, then check twice a day. */
export function startInstagramTokenRefresh(): void {
  const tick = () => void refreshIfDue().catch((err) => logger.error('Instagram token check failed', err));
  tick();
  setInterval(tick, CHECK_EVERY_MS).unref();
}
