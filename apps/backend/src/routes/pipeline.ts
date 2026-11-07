import express, { type Request, type Response, type Router } from 'express';
import { prisma } from '@propgroup/db';
import { authenticateToken, logAdminAction, requireCrm } from '../middleware/auth.js';
import { asyncHandler } from '../utils/errors.js';
import { sendNotFound, sendSuccess } from '../utils/response.js';
import { z } from 'zod';
import type { AuthenticatedRequest } from '../types/index.js';
import { getChatAiSettings } from '../services/ai-settings.service.js';
import { autoReplyEnabled } from '../services/auto-reply.service.js';

// ─────────────────────────────────────────────────────────────────────────────
// The front of the pipeline: people, before there is a deal. Each column
// answers one question — who owes the next message?
//
//   To answer   — a PERSON owes them: the assistant handed over (and promised a
//                 colleague), they wrote and the assistant is not handling it,
//                 a lead form nobody has called, or a "ping later" that is due
//   Assistant   — the assistant is handling the conversation
//   With you    — the team is talking to them and the ball is in their court
//   On hold     — someone is checking something for them, or they are parked
//                 until something happens. Only a person puts them here.
//   Gone quiet  — only when someone moves them there. Silence alone never
//                 does it: a quiet chat is often a client the team is phoning.
//                 Where "noise" (never answered) and "ping later" are decided
//   Ping later  — snoozed until a date, then back in "To answer"
//
// There used to be a "New" column for "nobody has answered yet". The assistant
// answers in seconds, and anyone waiting ten minutes went to "With you", so New
// was empty all day. The real question — is a person needed? — is To answer.
//
// Silence longer than DROP_MS leaves the board by itself (the client list keeps
// them); a message from them brings them straight back.
//
// Property deals start at "Viewing / meeting booked" and come from /deals.
// ─────────────────────────────────────────────────────────────────────────────

const router: Router = express.Router();

router.use(authenticateToken, requireCrm);

/** Deal stages that put a client on the property side of the board instead. */
const ADVANCED = ['VIEWING_BOOKED', 'VIEWED', 'INTERESTED', 'OFFER_MADE', 'RESERVED'];
/** Properties sent or picked, but nothing booked. */
const SHORTLISTED = ['SUGGESTED', 'SHARED'];
/** Unanswered for this long and the assistant has not picked it up: a person is needed. */
const WAITING_MS = 10 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Silent this long: the card says so, but it stays where it is. */
const QUIET_MS = 3 * DAY_MS;
/** Silent this long and nothing planned: off the board (still in the client list). */
const DROP_MS = 30 * DAY_MS;
/** An inbound lead with no conversation drops off the front of the board after this. */
const FRESH_MS = 30 * 24 * 60 * 60 * 1000;
/**
 * Where a lead came in by itself — the only kind that belongs in "New" without
 * a conversation. A client the team typed in, imported, or met by phone has
 * already been spoken to; it lives in the client list, not at the front of a
 * board about who is reaching out.
 */
const INBOUND_SOURCES = ['FACEBOOK_AD', 'INQUIRY', 'WHATSAPP', 'FAVORITE'];
/** Selling or renting out: someone to list, not someone to show property to. */
const SUPPLY = ['SELLER', 'LANDLORD'];

type Bucket = 'TO_ANSWER' | 'ASSISTANT' | 'WITH_YOU' | 'ON_HOLD' | 'QUIET' | 'PING_LATER';

// GET /api/crm/pipeline — open clients who have not reached a viewing yet
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const market = req.query.market;
    const now = Date.now();

    const leads = await prisma.lead.findMany({
      where: {
        status: { notIn: ['WON', 'LOST', 'ARCHIVED'] },
        ...(market === 'LEBANON' || market === 'GEORGIA' ? { market } : {}),
        opportunities: { none: { stage: { in: ADVANCED as never } } },
        // Someone in a live conversation, or a lead that came in on its own in
        // the last month (an ad form, a website enquiry). Everybody else is in
        // the client list.
        OR: [
          { conversations: { some: { archivedAt: null } } },
          { source: { in: INBOUND_SOURCES as never }, createdAt: { gte: new Date(now - FRESH_MS) } },
        ],
      },
      select: {
        id: true, name: true, market: true, type: true, intents: true, isInvestor: true, source: true,
        adLabel: true, adId: true, askingFor: true, budgetMax: true, lastContactAt: true, createdAt: true,
        nextContactAt: true, nextContactNote: true, snoozedAt: true, quietAt: true,
        flaggedAt: true, flagNote: true, flaggedBy: true,
        holdAt: true, holdKind: true, holdNote: true,
        opportunities: { select: { stage: true } },
        conversations: {
          where: { archivedAt: null },
          orderBy: { lastMessageAt: 'desc' },
          take: 1,
          select: {
            id: true, channel: true, lastMessageAt: true, lastPreview: true, unreadCount: true,
            aiPaused: true, aiPausedReason: true, aiAlways: true, adId: true,
            suggestions: { where: { status: 'PENDING' }, select: { id: true } },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 500,
    });

    // Who spoke last on each thread, and when it actually arrived.
    const ids = leads.flatMap((l) => l.conversations.map((c) => c.id));
    const [lastOut, lastIn] = ids.length
      ? await Promise.all([
          prisma.chatMessage.findMany({
            where: { conversationId: { in: ids }, direction: 'OUT' },
            distinct: ['conversationId'],
            orderBy: { createdAt: 'desc' },
            select: { conversationId: true, origin: true, createdAt: true },
          }),
          prisma.chatMessage.findMany({
            where: { conversationId: { in: ids }, direction: 'IN' },
            distinct: ['conversationId'],
            orderBy: { createdAt: 'desc' },
            select: { conversationId: true, createdAt: true },
          }),
        ])
      : [[], []];
    const outOf = new Map(lastOut.map((m) => [m.conversationId, m]));
    const inOf = new Map(lastIn.map((m) => [m.conversationId, m]));

    // A seller or landlord with no buyer side is not someone to book a viewing
    // for — unless they are actually writing to us.
    const relevant = leads.filter(
      (l) => l.conversations.length > 0 || !(l.intents.length ? l.intents : [l.type]).every((t) => SUPPLY.includes(t))
    );

    // Whether the assistant answers at all, and how it treats a team reply —
    // a waiting client it will not answer needs a person now, not in ten minutes.
    const settings = await getChatAiSettings();
    const assistantOn = autoReplyEnabled() && settings.enabled;

    const clients = relevant.map((l) => {
      const chat = l.conversations[0] ?? null;
      const out = chat ? outOf.get(chat.id) : undefined;
      const inbound = chat ? inOf.get(chat.id) : undefined;
      // A message already there when someone put them on hold is what they are
      // on hold about; only a newer one needs answering.
      const waitingSince =
        inbound && (!out || inbound.createdAt > out.createdAt) &&
        !(l.holdAt && inbound.createdAt.getTime() <= l.holdAt.getTime())
          ? inbound.createdAt : null;
      const waited = waitingSince ? now - waitingSince.getTime() : 0;

      // Who spoke last: the client, the assistant, or one of us.
      const lastFrom: 'client' | 'assistant' | 'team' | null = waitingSince
        ? 'client'
        : out
          ? out.origin === 'AI' ? 'assistant' : 'team'
          : null;
      // The latest of the chat and any contact logged by hand — a phone call
      // counts as much as a message.
      const touched = [chat?.lastMessageAt, l.lastContactAt].filter((d): d is Date => Boolean(d));
      const lastActivity = touched.length ? new Date(Math.max(...touched.map((d) => d.getTime()))) : l.createdAt;
      const silentFor = now - new Date(lastActivity).getTime();
      const pingAt = l.nextContactAt;

      // Would the assistant answer this client's message by itself?
      const teamRecently = out && out.origin !== 'AI' && now - out.createdAt.getTime() < DAY_MS;
      const fromAd = Boolean(chat?.adId || l.adId || l.source === 'FACEBOOK_AD');
      const assistantAnswers =
        assistantOn && chat && !chat.aiPaused && (settings.audience === 'all' || fromAd || chat.aiAlways) &&
        (!teamRecently || chat.aiAlways || settings.handover === 'always');

      // A snooze someone chose wins over "they wrote last" — that was exactly the
      // case being snoozed (Shadi went straight back to To answer). Only a
      // message that arrives after the snooze wakes it early.
      const snoozed = Boolean(
        pingAt && pingAt.getTime() > now &&
        (!waitingSince || (l.snoozedAt && waitingSince.getTime() <= l.snoozedAt.getTime()))
      );

      let bucket: Bucket;
      let reason: string | null = null;
      if (snoozed) {
        bucket = 'PING_LATER';
        reason = l.nextContactNote;
      } else if (waitingSince) {
        // They wrote and nobody has answered.
        if (assistantAnswers && waited < WAITING_MS) bucket = 'ASSISTANT';
        else {
          bucket = 'TO_ANSWER';
          reason = pingAt && pingAt.getTime() > now
            ? 'They wrote while snoozed'
            : l.holdAt
              ? `They wrote while on hold${l.holdNote ? `: ${l.holdNote}` : ''}`
            : chat?.aiPaused
              ? `Handed over: ${chat.aiPausedReason ?? 'the assistant passed this to you'}`
              : teamRecently ? 'They replied to you' : 'Waiting for a reply';
        }
      } else if (pingAt && pingAt.getTime() > now) {
        bucket = 'PING_LATER';
        reason = l.nextContactNote;
      } else if (pingAt) {
        bucket = 'TO_ANSWER';
        reason = `Ping them${l.nextContactNote ? `: ${l.nextContactNote}` : ' — the date you set has come'}`;
      } else if (l.holdAt) {
        // Someone is checking something for them, or parked them on purpose.
        bucket = 'ON_HOLD';
        reason = l.holdNote;
      } else if (!chat) {
        // A lead form or a website enquiry: no chat, so someone has to call.
        bucket = l.lastContactAt ? 'WITH_YOU' : 'TO_ANSWER';
        if (!l.lastContactAt) reason = l.source === 'FACEBOOK_AD' ? 'Lead form — call them' : 'Enquiry — nobody has contacted them';
      } else if (chat.aiPaused && out?.origin === 'AI') {
        // The assistant's last words were "a colleague will message you" and no
        // colleague has. The client is not writing because they were told to wait.
        bucket = 'TO_ANSWER';
        reason = `Promised a colleague: ${chat.aiPausedReason ?? 'the assistant handed this to you'}`;
      } else if (l.quietAt && lastActivity.getTime() <= l.quietAt.getTime()) {
        // The team put them here, and nothing has happened since.
        bucket = 'QUIET';
        reason = `No reply for ${Math.floor(silentFor / DAY_MS)} days`;
      } else {
        bucket = out?.origin === 'AI' ? 'ASSISTANT' : 'WITH_YOU';
        // Long silence is shown, not acted on — moving them is the team's call.
        reason = silentFor >= QUIET_MS
          ? `No reply for ${Math.floor(silentFor / DAY_MS)} days`
          : out || bucket === 'ASSISTANT' ? null : 'Contacted outside the chat';
      }

      return {
        id: l.id,
        name: l.name,
        market: l.market,
        type: l.type,
        isInvestor: l.isInvestor,
        source: l.source,
        adLabel: l.adLabel,
        askingFor: l.askingFor,
        budgetMax: l.budgetMax,
        bucket,
        reason,
        lastFrom,
        supplyOnly: (l.intents.length ? l.intents : [l.type]).every((t) => SUPPLY.includes(t)),
        waitingSince,
        shortlisted: l.opportunities.filter((o) => SHORTLISTED.includes(o.stage)).length,
        chat: chat
          ? {
              id: chat.id,
              channel: chat.channel,
              lastMessageAt: chat.lastMessageAt,
              lastPreview: chat.lastPreview,
              unread: chat.unreadCount,
              detailsToConfirm: chat.suggestions.length > 0,
            }
          : null,
        pingAt,
        lastActivity,
        silentFor,
        flag: l.flaggedAt ? { at: l.flaggedAt, note: l.flagNote, by: l.flaggedBy } : null,
        hold: l.holdAt ? { at: l.holdAt, kind: l.holdKind === 'PARKED' ? 'PARKED' : 'CHECKING', note: l.holdNote } : null,
      };
    })
      // A month of silence with nothing planned: off the board until they write.
      .filter((c) => !['QUIET', 'WITH_YOU', 'ASSISTANT'].includes(c.bucket) || c.silentFor < DROP_MS)
      .map(({ silentFor: _s, ...c }) => c);

    // Most urgent first within each column: waiting longest, then most recent.
    clients.sort((a, b) => {
      if (a.waitingSince && b.waitingSince) return a.waitingSince.getTime() - b.waitingSince.getTime();
      if (a.waitingSince) return -1;
      if (b.waitingSince) return 1;
      return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime();
    });

    sendSuccess(res, clients);
  })
);

// POST /api/crm/pipeline/:id/action — what to do with someone at the front of
// the board who is not becoming a deal (yet).
//   noise          — never wrote back after our first replies. Parked (and the
//                    chat archived) until they write again.
//   quiet          — move to "Gone quiet". Any message or logged contact
//                    afterwards brings them back.
//   ping_later     — snooze until a date; then they are back in "To answer".
//   not_interested — said no. Lost; still in the client list.
//   hold           — "On hold": checking something for them (kind CHECKING)
//                    or parked until something happens (PARKED), with a note.
//   unhold         — off hold, back to wherever the conversation puts them.
// Every other move takes them off hold.
// POST /api/crm/pipeline/:id/flag — paint the client's cards red for the team
// to look at, with a note; `{ clear: true }` takes it off.
router.post(
  '/:id/flag',
  asyncHandler(async (req: Request, res: Response) => {
    const body = z
      .object({ clear: z.boolean().optional(), note: z.string().trim().max(200).optional() })
      .parse(req.body ?? {});
    const lead = await prisma.lead.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!lead) { sendNotFound(res, 'Lead'); return; }
    const user = (req as AuthenticatedRequest).user;
    const by = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || null;
    const data = body.clear
      ? { flaggedAt: null, flagNote: null, flaggedBy: null }
      : { flaggedAt: new Date(), flagNote: body.note || null, flaggedBy: by };
    await prisma.lead.update({ where: { id: lead.id }, data });
    await logAdminAction(body.clear ? 'PIPELINE_UNFLAG' : 'PIPELINE_FLAG', 'lead', lead.id, { note: body.note }, req as AuthenticatedRequest);
    sendSuccess(res, data);
  })
);

router.post(
  '/:id/action',
  asyncHandler(async (req: Request, res: Response) => {
    const body = z
      .object({
        action: z.enum(['noise', 'quiet', 'ping_later', 'not_interested', 'hold', 'unhold']),
        kind: z.enum(['CHECKING', 'PARKED']).optional(),
        days: z.number().int().min(1).max(180).optional(),
        note: z.string().trim().max(200).optional(),
      })
      .parse(req.body ?? {});
    const lead = await prisma.lead.findUnique({ where: { id: req.params.id }, select: { id: true, holdNote: true } });
    if (!lead) { sendNotFound(res, 'Lead'); return; }
    const offHold = { holdAt: null, holdKind: null, holdNote: null };

    if (body.action === 'hold') {
      await prisma.lead.update({
        where: { id: lead.id },
        data: {
          holdAt: new Date(), holdKind: body.kind ?? 'CHECKING', holdNote: body.note || null,
          quietAt: null, nextContactAt: null, nextContactNote: null,
        },
      });
    } else if (body.action === 'unhold') {
      await prisma.lead.update({ where: { id: lead.id }, data: offHold });
    } else if (body.action === 'noise') {
      await prisma.lead.update({
        where: { id: lead.id },
        data: { status: 'ARCHIVED', subStatus: 'NO_RESPONSE', nextContactAt: null, nextContactNote: null, ...offHold },
      });
      // Out of the inbox too. Both come back by themselves the moment they write.
      await prisma.conversation.updateMany({ where: { leadId: lead.id, archivedAt: null }, data: { archivedAt: new Date() } });
    } else if (body.action === 'quiet') {
      await prisma.lead.update({ where: { id: lead.id }, data: { quietAt: new Date(), ...offHold } });
    } else if (body.action === 'not_interested') {
      await prisma.lead.update({
        where: { id: lead.id },
        data: { status: 'LOST', nextContactAt: null, nextContactNote: null, closedAt: new Date(), ...offHold },
      });
      // "They said no to everything": their open deals end too. Left alone,
      // a client marked not interested stayed on the board as a Negotiating
      // card. Ruled out rather than deleted, so what they were shown is kept.
      await prisma.leadOpportunity.updateMany({
        where: { leadId: lead.id, stage: { notIn: ['WON', 'REJECTED'] as never } },
        data: { stage: 'REJECTED' as never, rejectionReason: 'CHANGED_MIND' as never },
      });
    } else {
      const days = body.days ?? 7;
      await prisma.lead.update({
        where: { id: lead.id },
        data: {
          nextContactAt: new Date(Date.now() + days * DAY_MS),
          snoozedAt: new Date(),
          quietAt: null,
          ...offHold,
          // Snoozing again keeps what you meant to do ("send new prices"); a
          // hold's note ("asking the developer for the 3rd floor") carries over.
          ...(body.note || lead.holdNote ? { nextContactNote: body.note || lead.holdNote } : {}),
          subStatus: 'AWAITING_REPLY',
        },
      });
    }
    await logAdminAction('PIPELINE_ACTION', 'lead', lead.id, { action: body.action, days: body.days, kind: body.kind }, req as AuthenticatedRequest);
    sendSuccess(res, { ok: true });
  })
);

export default router;
