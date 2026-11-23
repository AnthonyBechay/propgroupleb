import express, { type Request, type Response, type Router } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '@propgroup/db';
import { authenticateToken, requireRole, requireAdmin, logAdminAction, noCache } from '../middleware/auth.js';
import { asyncHandler } from '../utils/errors.js';
import { sendSuccess, sendCreated, sendNotFound, sendError, sendPaginated } from '../utils/response.js';
import { parsePagination, buildPaginationResponse } from '../utils/pagination.js';
import { normalisePhone, findLeadByPhone } from '../services/messaging-intake.service.js';
import {
  VIEWING_TERMS_VERSION,
  VIEWING_FEE_PERCENT,
  VIEWING_PROTECTION_MONTHS,
  viewingTermsSections,
  renderViewingTerms,
} from '../config/viewing-terms.js';
import type { AuthenticatedRequest } from '../types/index.js';

/**
 * Viewing agreements: the client signs PropGroup's showing rules on the
 * agent's phone or tablet before a viewing. See `config/viewing-terms.ts`.
 *
 * Anyone who shows properties may create one (agents included); only an admin
 * may void one. Nothing here is public — a signature never leaves the staff API.
 */
const router: Router = express.Router();

const requireStaff = requireRole('AGENT', 'CRM_MANAGER', 'ADMIN', 'SUPER_ADMIN');

router.use(noCache);

// A drawn signature is a few tens of KB; anything near this is not a signature.
const MAX_SIGNATURE_CHARS = 600_000;

const createSchema = z.object({
  clientName: z.string().trim().min(2, 'Client name is required').max(200),
  clientPhone: z.string().trim().max(40).optional().nullable(),
  clientEmail: z.string().trim().email('Invalid email').max(200).optional().nullable().or(z.literal('')),
  clientIdNumber: z.string().trim().max(80).optional().nullable(),
  leadId: z.string().trim().max(60).optional().nullable(),
  buildingIds: z.array(z.string().trim().max(60)).max(20).default([]),
  propertyNote: z.string().trim().max(1000).optional().nullable(),
  viewingAt: z.coerce.date().optional(),
  notes: z.string().trim().max(2000).optional().nullable(),
  termsVersion: z.string(),
  acceptedTerms: z.literal(true, { errorMap: () => ({ message: 'The client must accept the terms' }) }),
  noPriorIntroduction: z.boolean().default(true),
  signatureData: z
    .string()
    .startsWith('data:image/png;base64,', 'Signature must be a PNG')
    .max(MAX_SIGNATURE_CHARS, 'Signature image is too large'),
});

/** VA-20261123-7K3Q — short enough to read out, unique enough not to collide. */
function newRef(): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(4);
  const tail = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
  return `VA-${ymd}-${tail}`;
}

/** SHA-256 over everything the client agreed to, signature included. */
function hashAgreement(fields: Record<string, unknown>): string {
  return crypto.createHash('sha256').update(JSON.stringify(fields)).digest('hex');
}

// ── GET /terms — the current terms, for the form to display ──────────────────
router.get(
  '/terms',
  authenticateToken,
  requireStaff,
  asyncHandler(async (_req: Request, res: Response) => {
    sendSuccess(res, {
      version: VIEWING_TERMS_VERSION,
      feePercent: VIEWING_FEE_PERCENT,
      protectionMonths: VIEWING_PROTECTION_MONTHS,
      sections: viewingTermsSections(),
    });
  })
);

// ── GET / — list (no signature images, they're heavy) ────────────────────────
router.get(
  '/',
  authenticateToken,
  requireStaff,
  asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, skip } = parsePagination(req.query as Record<string, string>);
    const { search, leadId, buildingId, status } = req.query as Record<string, string | undefined>;
    const user = (req as AuthenticatedRequest).user;

    const where: Record<string, unknown> = {};
    // An agent sees the agreements they collected; the office sees all.
    if (user.role === 'AGENT') where.agentId = user.id;
    if (leadId) where.leadId = leadId;
    if (buildingId) where.buildingIds = { has: buildingId };
    if (status === 'SIGNED' || status === 'VOID') where.status = status;
    if (search) {
      where.OR = [
        { ref: { contains: search, mode: 'insensitive' } },
        { clientName: { contains: search, mode: 'insensitive' } },
        { clientPhone: { contains: search, mode: 'insensitive' } },
        { clientEmail: { contains: search, mode: 'insensitive' } },
        { propertyNote: { contains: search, mode: 'insensitive' } },
        { agentName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [rows, total] = await Promise.all([
      prisma.viewingAgreement.findMany({
        where,
        orderBy: { signedAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          ref: true,
          status: true,
          clientName: true,
          clientPhone: true,
          leadId: true,
          properties: true,
          propertyNote: true,
          viewingAt: true,
          signedAt: true,
          agentName: true,
          feePercent: true,
        },
      }),
      prisma.viewingAgreement.count({ where }),
    ]);

    sendPaginated(res, rows, buildPaginationResponse(page, limit, total));
  })
);

// ── GET /:id — full record, signature included ───────────────────────────────
router.get(
  '/:id',
  authenticateToken,
  requireStaff,
  asyncHandler(async (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user;
    const row = await prisma.viewingAgreement.findFirst({
      where: { OR: [{ id: req.params.id }, { ref: req.params.id }] },
      include: { lead: { select: { id: true, name: true } } },
    });
    if (!row || (user.role === 'AGENT' && row.agentId !== user.id)) {
      sendNotFound(res, 'Viewing agreement');
      return;
    }
    sendSuccess(res, row);
  })
);

// ── POST / — sign ────────────────────────────────────────────────────────────
router.post(
  '/',
  authenticateToken,
  requireStaff,
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, 400, parsed.error.issues[0]?.message || 'Invalid agreement', parsed.error.issues);
      return;
    }
    const body = parsed.data;
    const user = (req as AuthenticatedRequest).user;

    // The client read one version on screen; if the server moved on meanwhile,
    // they must see the new text before signing it.
    if (body.termsVersion !== VIEWING_TERMS_VERSION) {
      sendError(res, 409, 'The terms were updated. Reload the form so the client can read the current version.');
      return;
    }

    const buildingIds = Array.from(new Set(body.buildingIds));
    if (buildingIds.length === 0 && !body.propertyNote) {
      sendError(res, 400, 'Add at least one property being shown');
      return;
    }

    const buildings = buildingIds.length
      ? await prisma.building.findMany({
          where: { id: { in: buildingIds } },
          select: { id: true, ref: true, title: true, city: true, neighborhood: true, country: true },
        })
      : [];
    if (buildings.length !== buildingIds.length) {
      sendError(res, 400, 'One of the properties no longer exists');
      return;
    }
    // Keep the order the agent picked them in.
    const properties = buildingIds.map((id) => {
      const b = buildings.find((x) => x.id === id)!;
      return { buildingId: b.id, ref: b.ref, title: b.title, city: b.neighborhood || b.city, country: b.country };
    });

    // Link the CRM client: explicit pick first, else the phone number.
    let leadId: string | null = null;
    if (body.leadId) {
      const lead = await prisma.lead.findUnique({ where: { id: body.leadId }, select: { id: true } });
      leadId = lead?.id ?? null;
    }
    if (!leadId && body.clientPhone) {
      const digits = normalisePhone(body.clientPhone);
      if (digits) leadId = (await findLeadByPhone(digits))?.id ?? null;
    }

    const termsText = renderViewingTerms(VIEWING_FEE_PERCENT, VIEWING_PROTECTION_MONTHS);
    const signedAt = new Date();
    const viewingAt = body.viewingAt ?? signedAt;
    const agentName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;

    const snapshot = {
      clientName: body.clientName,
      clientPhone: body.clientPhone || null,
      clientEmail: body.clientEmail || null,
      clientIdNumber: body.clientIdNumber || null,
      properties,
      propertyNote: body.propertyNote || null,
      viewingAt: viewingAt.toISOString(),
      termsVersion: VIEWING_TERMS_VERSION,
      termsText,
      feePercent: VIEWING_FEE_PERCENT,
      protectionMonths: VIEWING_PROTECTION_MONTHS,
      noPriorIntroduction: body.noPriorIntroduction,
      signedAt: signedAt.toISOString(),
      agentId: user.id,
      signatureSha256: crypto.createHash('sha256').update(body.signatureData).digest('hex'),
    };

    // A ref collision is ~1 in a million per day; retry rather than fail.
    let created = null;
    for (let attempt = 0; attempt < 3 && !created; attempt++) {
      try {
        created = await prisma.viewingAgreement.create({
          data: {
            ref: newRef(),
            clientName: snapshot.clientName,
            clientPhone: snapshot.clientPhone,
            clientEmail: snapshot.clientEmail,
            clientIdNumber: snapshot.clientIdNumber,
            leadId,
            properties,
            buildingIds,
            propertyNote: snapshot.propertyNote,
            viewingAt,
            termsVersion: VIEWING_TERMS_VERSION,
            termsText,
            feePercent: VIEWING_FEE_PERCENT,
            protectionMonths: VIEWING_PROTECTION_MONTHS,
            noPriorIntroduction: body.noPriorIntroduction,
            signatureData: body.signatureData,
            signedAt,
            signedIp: req.ip || null,
            signedUserAgent: req.get('User-Agent')?.slice(0, 500) || null,
            documentHash: hashAgreement(snapshot),
            agentId: user.id,
            agentName,
            notes: body.notes || null,
          },
          select: { id: true, ref: true, leadId: true, signedAt: true },
        });
      } catch (err: unknown) {
        if ((err as { code?: string }).code !== 'P2002' || attempt === 2) throw err;
      }
    }

    await logAdminAction('VIEWING_AGREEMENT_SIGNED', 'ViewingAgreement', created!.id, { ref: created!.ref, leadId, buildingIds }, req);
    sendCreated(res, created, 'Agreement signed');
  })
);

// ── POST /:id/void — admin only; the record stays, marked void ───────────────
router.post(
  '/:id/void',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const reason = String(req.body?.reason || '').trim().slice(0, 500);
    if (!reason) {
      sendError(res, 400, 'Give a reason for voiding');
      return;
    }
    const row = await prisma.viewingAgreement.findUnique({ where: { id: req.params.id }, select: { id: true, status: true } });
    if (!row) {
      sendNotFound(res, 'Viewing agreement');
      return;
    }
    const user = (req as AuthenticatedRequest).user;
    const updated = await prisma.viewingAgreement.update({
      where: { id: row.id },
      data: { status: 'VOID', voidedAt: new Date(), voidedBy: user.id, voidReason: reason },
      select: { id: true, status: true, voidedAt: true, voidReason: true },
    });
    await logAdminAction('VIEWING_AGREEMENT_VOIDED', 'ViewingAgreement', row.id, { reason }, req);
    sendSuccess(res, updated);
  })
);

export default router;
