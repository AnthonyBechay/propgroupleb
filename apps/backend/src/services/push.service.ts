import webpush from 'web-push';
import { prisma } from '@propgroup/db';
import { logger } from '../utils/logger.js';

/**
 * Notifications on the team's phones (and computers) when a client writes.
 *
 * Standard web push: the installed Inbox app — Add to Home Screen on iPhone
 * (iOS 16.4 or later), Install from Chrome on Android — or a desktop browser
 * subscribes once, and the server sends to it through the browser maker's push
 * service, even when the app is closed.
 *
 * The keys that sign those sends (VAPID) are created by the server the first
 * time it needs them and kept in the database, so there is nothing to set up.
 * VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY override them if ever needed — changing
 * the keys means every device has to turn notifications on again.
 */

const KEY = 'vapid_keys';
const SUBJECT = process.env.VAPID_SUBJECT || 'mailto:propgroupleb@gmail.com';

let keys: { publicKey: string; privateKey: string } | null = null;

async function vapid(): Promise<{ publicKey: string; privateKey: string }> {
  if (keys) return keys;
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    keys = { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
  } else {
    const row = await prisma.systemSetting.findUnique({ where: { key: KEY } });
    const saved = row?.value as { publicKey?: string; privateKey?: string } | undefined;
    if (saved?.publicKey && saved.privateKey) {
      keys = { publicKey: saved.publicKey, privateKey: saved.privateKey };
    } else {
      keys = webpush.generateVAPIDKeys();
      await prisma.systemSetting.create({
        data: { key: KEY, value: keys, category: 'integration', description: 'Web push signing keys (created automatically)' },
      });
      logger.info('Web push keys created');
    }
  }
  webpush.setVapidDetails(SUBJECT, keys.publicKey, keys.privateKey);
  return keys;
}

export async function pushPublicKey(): Promise<string> {
  return (await vapid()).publicKey;
}

export interface PushMessage {
  title: string;
  body: string;
  /** Where tapping it opens. */
  url: string;
  /** Same tag replaces the previous notification: one per conversation, not one per message. */
  tag: string;
  /** 'needs_you' reaches every device; 'message' only those that want every message. */
  kind: 'message' | 'needs_you';
}

/** Send to every subscribed device of the team (or of one user). Never throws. */
export async function notifyTeam(message: PushMessage, only?: { userId: string }): Promise<void> {
  try {
    const subs = await prisma.pushSubscription.findMany({
      where: {
        ...(message.kind === 'needs_you' ? {} : { mode: 'all' }),
        ...(only ? { userId: only.userId } : {}),
      },
    });
    if (subs.length === 0) return;
    await vapid();
    const payload = JSON.stringify(message);
    await Promise.all(
      subs.map(async (s) => {
        try {
          // A notification about a chat is worthless after a few hours.
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload,
            { TTL: 6 * 60 * 60, urgency: 'high', topic: message.tag.slice(0, 32).replace(/[^A-Za-z0-9_-]/g, '') }
          );
          await prisma.pushSubscription.update({ where: { id: s.id }, data: { lastSentAt: new Date() } });
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            // The device unsubscribed or the app was removed.
            await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => undefined);
          } else {
            logger.warn('Push not delivered', { status, error: (err as Error).message });
          }
        }
      })
    );
  } catch (err) {
    logger.error('Push failed', err);
  }
}

/** A client wrote: tell the team, saying whether a person is needed. */
export async function notifyInboundMessage(conversationId: string): Promise<void> {
  try {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        id: true, channel: true, externalId: true, displayName: true, lastPreview: true, archivedAt: true,
        lead: { select: { name: true } },
      },
    });
    if (!conversation) return;
    const name = conversation.lead?.name || conversation.displayName || (conversation.channel === 'WHATSAPP' ? `+${conversation.externalId}` : 'Instagram');
    // Will the assistant take this one? Then it is news, not a call to act.
    const { autoReplyStatus } = await import('./auto-reply.service.js');
    const assistant = await autoReplyStatus(conversation.id);
    await notifyTeam({
      title: `${name}${conversation.channel === 'INSTAGRAM' ? ' · Instagram' : ''}`,
      body: `${conversation.lastPreview ?? 'New message'}${assistant.sent ? '' : ' — waiting for you'}`,
      url: `/admin/inbox?c=${conversation.id}`,
      tag: `chat-${conversation.id}`,
      kind: assistant.sent ? 'message' : 'needs_you',
    });
  } catch (err) {
    logger.error('Inbound push failed', err, { conversationId });
  }
}
