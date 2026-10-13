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
  replyStyle: z.enum(['match', 'latin', 'latin_always']).default('latin'),
  guidance: z.string().trim().max(1500).default(''),
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

    const settings = { ...data, preferred };
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
