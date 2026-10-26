import express, { type Request, type Response, type Router } from 'express';
import { z } from 'zod';
import { prisma } from '@propgroup/db';
import { authenticateToken, requireCrm } from '../middleware/auth.js';
import { asyncHandler } from '../utils/errors.js';
import { sendSuccess } from '../utils/response.js';
import type { AuthenticatedRequest } from '../types/index.js';
import { notifyTeam, pushPublicKey } from '../services/push.service.js';

// Turning chat notifications on and off for one device.

const router: Router = express.Router();

router.use(authenticateToken, requireCrm);

// GET /api/push/key — the public key a device subscribes with
router.get(
  '/key',
  asyncHandler(async (_req: Request, res: Response) => {
    sendSuccess(res, { publicKey: await pushPublicKey() });
  })
);

const subscriptionSchema = z.object({
  subscription: z.object({
    endpoint: z.string().url().max(1000),
    keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
  }),
  mode: z.enum(['all', 'needs_you']).default('all'),
});

// POST /api/push/subscribe — this device wants notifications
router.post(
  '/subscribe',
  asyncHandler(async (req: Request, res: Response) => {
    const { subscription, mode } = subscriptionSchema.parse(req.body);
    const userId = (req as AuthenticatedRequest).user.id;
    const data = {
      userId,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      mode,
      userAgent: (req.get('user-agent') ?? '').slice(0, 300),
    };
    await prisma.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      create: { endpoint: subscription.endpoint, ...data },
      update: data,
    });
    sendSuccess(res, { mode });
  })
);

// DELETE /api/push/subscribe — this device stops
router.delete(
  '/subscribe',
  asyncHandler(async (req: Request, res: Response) => {
    const { endpoint } = z.object({ endpoint: z.string().max(1000) }).parse(req.body);
    await prisma.pushSubscription.deleteMany({ where: { endpoint } });
    sendSuccess(res, null);
  })
);

// POST /api/push/test — "did it work?" — sent to this user's devices only
router.post(
  '/test',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as AuthenticatedRequest).user.id;
    const count = await prisma.pushSubscription.count({ where: { userId } });
    if (count === 0) {
      sendSuccess(res, { sent: 0 });
      return;
    }
    await notifyTeam(
      {
        title: 'Notifications are on',
        body: 'You will be told here when a client writes.',
        url: '/admin/inbox',
        tag: `test-${userId}`,
        kind: 'needs_you',
      },
      { userId }
    );
    sendSuccess(res, { sent: count });
  })
);

export default router;
