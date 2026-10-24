import express, { type Request, type Response, type Router } from 'express';
import { z } from 'zod';
import { authenticateToken, requireAdmin, logAdminAction } from '../middleware/auth.js';
import { asyncHandler } from '../utils/errors.js';
import { sendSuccess } from '../utils/response.js';
import type { AuthenticatedRequest } from '../types/index.js';
import { chatAiEnabled } from '../config/chat-ai.js';
import { aiBudget } from '../utils/ai-budget.js';
import { getChatAiSettings, saveChatAiSettings } from '../services/ai-settings.service.js';
import { cardsByRef, formatPrice, searchCatalogue } from '../services/catalogue.service.js';
import { canSendOn } from '../services/messaging-send.service.js';
import { instagramTokenStatus } from '../services/instagram-token.service.js';

// How the chat assistant behaves — admin only, because it decides what a
// machine says to clients in the office's name.

const router: Router = express.Router();

router.use(authenticateToken, requireAdmin);

// GET /api/crm/ai-settings — the settings, whether it can actually run, and
// the stock that can be put on the preferred list
router.get(
  '/',
  asyncHandler(async (_req: Request, res: Response) => {
    const [settings, budget, georgia, lebanon] = await Promise.all([
      getChatAiSettings(),
      aiBudget(),
      searchCatalogue({ market: 'GEORGIA', limit: 200 }),
      searchCatalogue({ market: 'LEBANON', limit: 200 }),
    ]);
    const option = (c: Awaited<ReturnType<typeof searchCatalogue>>[number], market: string) => ({
      ref: c.ref,
      title: c.title,
      location: c.location,
      market,
      isProject: c.isProject,
      price: formatPrice(c),
    });
    sendSuccess(res, {
      settings,
      status: {
        // Each of these must hold before a single reply is sent.
        masterSwitch: process.env.AUTO_REPLY_ENABLED === 'true',
        aiKey: chatAiEnabled(),
        whatsappSending: canSendOn('WHATSAPP'),
        instagramSending: canSendOn('INSTAGRAM'),
        instagramToken: instagramTokenStatus(),
        budget,
      },
      catalogue: [...georgia.map((c) => option(c, 'GEORGIA')), ...lebanon.map((c) => option(c, 'LEBANON'))],
    });
  })
);

const settingsSchema = z.object({
  enabled: z.boolean(),
  audience: z.enum(['ads', 'all']),
  preferred: z
    .array(z.object({ ref: z.string().trim().min(1).max(40), pitch: z.string().trim().max(300).default('') }))
    .max(10),
  marketWhenUnknown: z.enum(['ask', 'LEBANON', 'GEORGIA']).default('ask'),
  handover: z.enum(['step_aside', 'return_after_quiet', 'always']).default('return_after_quiet'),
  quietHours: z.union([z.literal(1), z.literal(3), z.literal(6), z.literal(12), z.literal(20)]).default(6),
  maxListings: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(3),
  replyStyle: z.enum(['match', 'latin', 'latin_always']).default('match'),
  modelTier: z.enum(['quality', 'economy']).default('quality'),
  office: z.object({
    name: z.string().trim().max(120).default(''),
    address: z.string().trim().max(300).default(''),
    mapsUrl: z.union([z.string().trim().url().max(500), z.literal('')]).default(''),
  }),
  knowledge: z
    .array(
      z.object({
        question: z.string().trim().min(1).max(300),
        answer: z.string().trim().min(1).max(1000),
        publish: z.boolean().default(false),
        market: z.enum(['GEORGIA', 'LEBANON', 'ALL']).default('GEORGIA'),
      })
    )
    .max(40)
    .default([]),
  guidance: z.string().trim().max(3000).default(''),
  followUp: z
    .object({
      enabled: z.boolean().default(false),
      afterDays: z.union([z.literal(3), z.literal(5), z.literal(7), z.literal(14)]).default(7),
      // Meta template names: lowercase letters, digits and underscores.
      templateName: z.union([z.string().trim().regex(/^[a-z0-9_]{1,512}$/, 'Template names are lowercase letters, numbers and _'), z.literal('')]).default(''),
      language: z.string().trim().regex(/^[a-z]{2,3}(_[A-Z]{2})?$/, 'A language code like en, ar or en_US').default('en'),
      text: z.string().trim().min(1).max(1024),
      useName: z.boolean().default(true),
      dailyLimit: z.number().int().min(1).max(200).default(20),
    })
    // Switching it on with no template would only fail every hour.
    .refine((f) => !f.enabled || f.templateName, { message: 'Add the approved template name before switching follow-ups on', path: ['templateName'] })
    .optional(),
});

// PUT /api/crm/ai-settings
router.put(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const data = settingsSchema.parse(req.body);

    // Only stock that is public and available can be recommended; a code that
    // no longer is gets dropped here rather than failing quietly in a chat.
    const live = new Set((await cardsByRef(data.preferred.map((p) => p.ref))).map((c) => c.ref.toUpperCase()));
    const preferred = data.preferred
      .map((p) => ({ ref: p.ref.toUpperCase(), pitch: p.pitch }))
      .filter((p) => live.has(p.ref));

    const settings = { ...data, preferred, followUp: data.followUp ?? (await getChatAiSettings()).followUp };
    await saveChatAiSettings(settings, authReq.user?.id);
    await logAdminAction(
      'UPDATE_CHAT_AI_SETTINGS', 'SystemSetting', 'chat_ai_settings',
      { enabled: settings.enabled, audience: settings.audience, preferred: preferred.map((p) => p.ref) },
      authReq
    );
    sendSuccess(res, { settings });
  })
);

export default router;
