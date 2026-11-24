import express, { type Request, type Response, type Router } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '@propgroup/db';
import { authenticateToken, requireRole, requireAdmin, requireCrm, logAdminAction, noCache } from '../middleware/auth.js';
import { asyncHandler } from '../utils/errors.js';
import { sendSuccess, sendCreated, sendNotFound, sendError, sendPaginated } from '../utils/response.js';
import { parsePagination, buildPaginationResponse } from '../utils/pagination.js';
import { marketOfCountry } from '../utils/market.js';
import { normalisePhone, findLeadByPhone } from '../services/messaging-intake.service.js';
import { renderViewingAgreementPdf } from '../services/viewing-agreement-pdf.service.js';
import {
  VIEWING_TERMS_VERSION,
  VIEWING_PROTECTION_MONTHS,
  VIEWING_FEE_CURRENCIES,
  FEE_PERCENT_MIN,
  FEE_PERCENT_MAX,
  FEE_AMOUNT_MAX,
  DEFAULT_VIEWING_FEE,
  parseViewingFee,
  feeLabel,
  viewingTermsSections,
  renderViewingTerms,
  type ViewingFee,
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

const optionalText = (max: number) => z.string().trim().max(max).optional().nullable();

const createSchema = z.object({
  // The client: an existing CRM client (leadId), or typed in. `createLead`
  // adds a typed-in client to the CRM; off, they exist only on the agreement.
  leadId: optionalText(60),
  createLead: z.boolean().default(false),
  clientName: z.string().trim().min(2, 'Client name is required').max(200),
  clientPhone: optionalText(40),
  clientEmail: z.string().trim().email('Invalid email').max(200).optional().nullable().or(z.literal('')),
  clientIdNumber: optionalText(80),

  buildingIds: z.array(z.string().trim().max(60)).max(20).default([]),
  propertyNote: optionalText(1000),
  viewingAt: z.coerce.date().optional(),
  notes: optionalText(2000),

  feeType: z.enum(['PERCENT', 'FIXED']).default('PERCENT'),
  feeValue: z.coerce.number().optional(),
  feeCurrency: z.enum(VIEWING_FEE_CURRENCIES).optional(),

  termsVersion: z.string(),
  acceptedTerms: z.literal(true, { errorMap: () => ({ message: 'The client must accept the terms' }) }),
  noPriorIntroduction: z.boolean().default(true),
  priorIntroductionNote: optionalText(500),
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

/** The fee as stored on a row, back into its typed form. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function feeOfRow(row: any): ViewingFee {
  if (row.feeType === 'FIXED' && row.feeAmount != null) {
    return { type: 'FIXED', amount: Number(row.feeAmount), currency: row.feeCurrency || 'USD' };
  }
  const fallback = DEFAULT_VIEWING_FEE.type === 'PERCENT' ? DEFAULT_VIEWING_FEE.percent : 2.5;
  return { type: 'PERCENT', percent: row.feePercent != null ? Number(row.feePercent) : fallback };
}

const FEE_ERROR = `The fee must be between ${FEE_PERCENT_MIN}% and ${FEE_PERCENT_MAX}%, or a fixed amount up to ${FEE_AMOUNT_MAX.toLocaleString('en-US')}.`;

// ── GET /terms — the terms for the fee being offered ─────────────────────────
// ?feeType=PERCENT|FIXED&feeValue=3&feeCurrency=USD. No fee → the 2.5% default.
router.get(
  '/terms',
  authenticateToken,
  requireStaff,
  asyncHandler(async (req: Request, res: Response) => {
    const fee = parseViewingFee(req.query as Record<string, unknown>);
    if (!fee) {
      sendError(res, 400, FEE_ERROR);
      return;
    }
    sendSuccess(res, {
      version: VIEWING_TERMS_VERSION,
      fee,
      feeLabel: feeLabel(fee),
      defaultFee: DEFAULT_VIEWING_FEE,
      currencies: VIEWING_FEE_CURRENCIES,
      protectionMonths: VIEWING_PROTECTION_MONTHS,
      sections: viewingTermsSections(fee),
    });
  })
);

// ── GET /clients — quick CRM client lookup for the form ──────────────────────
// Same audience as the CRM itself; a narrow projection, not the pipeline row.
router.get(
  '/clients',
  authenticateToken,
  requireCrm,
  asyncHandler(async (req: Request, res: Response) => {
    const q = String(req.query.search || '').trim();
    if (q.length < 2) {
      sendSuccess(res, []);
      return;
    }
    const digits = q.replace(/\D/g, '');
    const rows = await prisma.lead.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
          { phone: { contains: q } },
          { whatsapp: { contains: q } },
          ...(digits.length >= 4 ? [{ phone: { contains: digits } }, { whatsapp: { contains: digits } }] : []),
        ],
      },
      orderBy: { updatedAt: 'desc' },
      take: 10,
      select: { id: true, name: true, phone: true, whatsapp: true, email: true, market: true, status: true },
    });
    sendSuccess(res, rows);
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
          feeType: true,
          feePercent: true,
          feeAmount: true,
          feeCurrency: true,
        },
      }),
      prisma.viewingAgreement.count({ where }),
    ]);

    sendPaginated(res, rows.map((r) => ({ ...r, feeLabel: feeLabel(feeOfRow(r)) })), buildPaginationResponse(page, limit, total));
  })
);

/** One agreement the caller may see, or null. Agents see only their own. */
async function findVisible(req: Request) {
  const user = (req as AuthenticatedRequest).user;
  const row = await prisma.viewingAgreement.findFirst({
    where: { OR: [{ id: req.params.id }, { ref: req.params.id }] },
    include: { lead: { select: { id: true, name: true } } },
  });
  if (!row || (user.role === 'AGENT' && row.agentId !== user.id)) return null;
  return row;
}

// ── GET /:id/pdf — the signed copy to send the client ────────────────────────
// ?tz=Asia/Tbilisi renders dates in the downloading device's time zone.
router.get(
  '/:id/pdf',
  authenticateToken,
  requireStaff,
  asyncHandler(async (req: Request, res: Response) => {
    const row = await findVisible(req);
    if (!row) {
      sendNotFound(res, 'Viewing agreement');
      return;
    }
    const pdf = await renderViewingAgreementPdf(
      {
        ...row,
        properties: (row.properties as Array<{ ref: string | null; title: string; city: string | null }>) ?? [],
        feeLabel: feeLabel(feeOfRow(row)),
      },
      String(req.query.tz || 'UTC'),
    );
    const name = `PropGroup-viewing-agreement-${row.ref}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `${req.query.download ? 'attachment' : 'inline'}; filename="${name}"`);
    res.setHeader('Content-Length', String(pdf.byteLength));
    res.end(Buffer.from(pdf));
  })
);

// ── GET /:id — full record, signature included ───────────────────────────────
router.get(
  '/:id',
  authenticateToken,
  requireStaff,
  asyncHandler(async (req: Request, res: Response) => {
    const row = await findVisible(req);
    if (!row) {
      sendNotFound(res, 'Viewing agreement');
      return;
    }
    sendSuccess(res, { ...row, feeLabel: feeLabel(feeOfRow(row)) });
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

    const fee = parseViewingFee({ feeType: body.feeType, feeValue: body.feeValue, feeCurrency: body.feeCurrency });
    if (!fee) {
      sendError(res, 400, FEE_ERROR);
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

    // ── Who the client is in the CRM ──
    // 1. picked from the CRM; 2. a typed-in phone that already belongs to a
    // client (never create a duplicate of someone we know); 3. a new client,
    // if the agent asked for one; 4. otherwise the agreement stands alone.
    let leadId: string | null = null;
    let leadCreated = false;
    if (body.leadId) {
      const lead = await prisma.lead.findUnique({ where: { id: body.leadId }, select: { id: true } });
      if (!lead) {
        sendError(res, 400, 'That CRM client no longer exists — pick them again or add them as new');
        return;
      }
      leadId = lead.id;
    }
    if (!leadId && body.clientPhone) {
      const digits = normalisePhone(body.clientPhone);
      if (digits) leadId = (await findLeadByPhone(digits))?.id ?? null;
    }
    const canCreateLead = ['CRM_MANAGER', 'ADMIN', 'SUPER_ADMIN'].includes(user.role);
    if (!leadId && body.createLead && canCreateLead) {
      const lead = await prisma.lead.create({
        data: {
          name: body.clientName,
          phone: body.clientPhone || null,
          email: body.clientEmail || null,
          market: marketOfCountry(properties[0]?.country ?? 'LEBANON'),
          type: 'BUYER',
          intents: ['BUYER'],
          source: 'WALK_IN',
          createdBy: user.id,
          assignees: [user.id],
        },
        select: { id: true, name: true, market: true },
      });
      leadId = lead.id;
      leadCreated = true;
      await logAdminAction('CREATE_LEAD', 'lead', lead.id, { name: lead.name, market: lead.market, via: 'viewing-agreement' }, req);
    }

    const termsText = renderViewingTerms(fee, VIEWING_PROTECTION_MONTHS);
    const signedAt = new Date();
    const viewingAt = body.viewingAt ?? signedAt;
    const agentName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;
    const priorIntroductionNote = body.noPriorIntroduction ? null : body.priorIntroductionNote || null;

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
      fee,
      protectionMonths: VIEWING_PROTECTION_MONTHS,
      noPriorIntroduction: body.noPriorIntroduction,
      priorIntroductionNote,
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
            feeType: fee.type,
            feePercent: fee.type === 'PERCENT' ? fee.percent : null,
            feeAmount: fee.type === 'FIXED' ? fee.amount : null,
            feeCurrency: fee.type === 'FIXED' ? fee.currency : null,
            protectionMonths: VIEWING_PROTECTION_MONTHS,
            noPriorIntroduction: body.noPriorIntroduction,
            priorIntroductionNote,
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

    // On the client's history, where the team looks first.
    if (leadId) {
      const shown = [...properties.map((p) => p.ref || p.title), ...(snapshot.propertyNote ? [snapshot.propertyNote] : [])].join(', ');
      try {
        await prisma.$transaction([
          prisma.leadContact.create({
            data: {
              leadId,
              channel: 'VIEWING',
              body: `Signed viewing agreement ${created!.ref} (fee ${feeLabel(fee)}) — ${shown}`,
              contactedAt: viewingAt,
              createdBy: user.id,
            },
          }),
          prisma.lead.update({ where: { id: leadId }, data: { lastContactAt: signedAt } }),
        ]);
      } catch {
        // The agreement is signed and stored; a missing history line is not
        // worth failing the client's signature over.
      }
    }

    await logAdminAction('VIEWING_AGREEMENT_SIGNED', 'ViewingAgreement', created!.id, { ref: created!.ref, leadId, leadCreated, buildingIds, fee }, req);
    sendCreated(res, { ...created, leadCreated }, 'Agreement signed');
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
    if (row.status === 'VOID') {
      sendError(res, 409, 'This agreement is already void');
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
