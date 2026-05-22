import express, { type Request, type Response, type Router } from 'express';
import { z } from 'zod';
import { prisma } from '@propgroup/db';
import { authenticateToken, requireAdmin, requirePropertyManager, logAdminAction } from '../middleware/auth.js';
import { asyncHandler } from '../utils/errors.js';
import { sendSuccess, sendCreated, sendPaginated, sendNotFound } from '../utils/response.js';
import { parsePagination, buildPaginationResponse } from '../utils/pagination.js';
import { ticketSchema, ticketUpdateSchema } from '../schemas/index.js';
import type { AuthenticatedRequest } from '../types/index.js';

const router: Router = express.Router();

// ── Inline update schemas ─────────────────────────────────────────────────────

const ticketPutSchema = z.object({
  status: z.enum(['OPEN', 'TRIAGED', 'SCHEDULED', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED']).optional(),
  category: z.enum(['PLUMBING', 'ELECTRICAL', 'HVAC', 'APPLIANCE', 'STRUCTURAL', 'CLEANING', 'PEST', 'KEYS_LOCKS', 'INTERNET', 'GENERATOR', 'ELEVATOR', 'WATER_TANK', 'OTHER']).optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'EMERGENCY']).optional(),
  assignedToUserId: z.string().optional().nullable(),
  vendorId: z.string().optional().nullable(),
  costEstimate: z.number().optional().nullable(),
  costActual: z.number().optional().nullable(),
  costCurrency: z.enum(['USD', 'LBP']).optional().nullable(),
  scheduledFor: z.string().optional().nullable(),
  resolvedAt: z.string().optional().nullable(),
});

const ticketPhotoSchema = z.object({
  fileKey: z.string().min(1, 'fileKey is required'),
  caption: z.string().optional().nullable(),
});

// ── GET / — list tickets ──────────────────────────────────────────────────────

router.get(
  '/',
  authenticateToken,
  requirePropertyManager,
  asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, skip } = parsePagination(req.query as Record<string, string>);
    const { buildingId, unitId, status, priority, category, scope } = req.query as Record<string, string>;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {};
    if (buildingId) where.buildingId = buildingId;
    if (unitId) where.unitId = unitId;
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (category) where.category = category;
    if (scope) where.scope = scope;

    // EMERGENCY tickets always surface first; within same priority sort by createdAt desc
    const orderBy = [
      {
        priority: 'desc' as const, // Prisma sorts enums alphabetically — EMERGENCY > HIGH > NORMAL > LOW
      },
      { createdAt: 'desc' as const },
    ];

    const [tickets, total] = await Promise.all([
      prisma.maintenanceTicket.findMany({
        where,
        include: {
          building: { select: { id: true, title: true, slug: true } },
          unit: { select: { id: true, unitNumber: true, kind: true, name: true } },
          vendor: { select: { id: true, name: true, phone: true, whatsapp: true } },
          _count: { select: { updates: true, photos: true } },
        },
        orderBy,
        skip,
        take: limit,
      }),
      prisma.maintenanceTicket.count({ where }),
    ]);

    sendPaginated(res, tickets, buildPaginationResponse(page, limit, total));
  })
);

// ── GET /:id — ticket detail ──────────────────────────────────────────────────

router.get(
  '/:id',
  authenticateToken,
  requirePropertyManager,
  asyncHandler(async (req: Request, res: Response) => {
    const ticket = await prisma.maintenanceTicket.findUnique({
      where: { id: req.params.id },
      include: {
        building: { select: { id: true, title: true, slug: true } },
        unit: { select: { id: true, unitNumber: true, kind: true, name: true } },
        vendor: { select: { id: true, name: true, phone: true, whatsapp: true } },
        photos: { orderBy: { createdAt: 'asc' } },
        updates: {
          include: {
            // assignedTo is not a relation on TicketUpdate; authorUser is the actor
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!ticket) { sendNotFound(res, 'Ticket'); return; }
    sendSuccess(res, ticket);
  })
);

// ── POST / — create ticket (any authenticated user) ───────────────────────────

router.post(
  '/',
  authenticateToken,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const data = ticketSchema.parse(req.body);

    const ticket = await prisma.maintenanceTicket.create({
      data: {
        ...data,
        reportedBy: authReq.user.id,
        scheduledFor: data.scheduledFor ? new Date(data.scheduledFor) : undefined,
      },
    });

    await logAdminAction('CREATE_TICKET', 'maintenanceTicket', ticket.id, {
      buildingId: ticket.buildingId,
      priority: ticket.priority,
      category: ticket.category,
    }, authReq);

    sendCreated(res, ticket, 'Ticket created successfully');
  })
);

// ── PUT /:id — update ticket (manager) ───────────────────────────────────────

router.put(
  '/:id',
  authenticateToken,
  requirePropertyManager,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const data = ticketPutSchema.parse(req.body);

    const existing = await prisma.maintenanceTicket.findUnique({
      where: { id: req.params.id },
      select: { id: true, status: true },
    });
    if (!existing) { sendNotFound(res, 'Ticket'); return; }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = { ...data };
    if (data.scheduledFor) updateData.scheduledFor = new Date(data.scheduledFor);
    else if (data.scheduledFor === null) updateData.scheduledFor = null;

    if (data.resolvedAt) {
      updateData.resolvedAt = new Date(data.resolvedAt);
    } else if (data.resolvedAt === null) {
      updateData.resolvedAt = null;
    } else if (data.status === 'RESOLVED' && existing.status !== 'RESOLVED') {
      updateData.resolvedAt = new Date();
    }

    const ticket = await prisma.maintenanceTicket.update({
      where: { id: req.params.id },
      data: updateData,
    });

    await logAdminAction('UPDATE_TICKET', 'maintenanceTicket', req.params.id, {
      status: ticket.status,
      priority: ticket.priority,
    }, authReq);

    sendSuccess(res, ticket, 'Ticket updated successfully');
  })
);

// ── POST /:id/updates — add status update / comment ──────────────────────────

router.post(
  '/:id/updates',
  authenticateToken,
  requirePropertyManager,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const data = ticketUpdateSchema.parse(req.body);

    const ticket = await prisma.maintenanceTicket.findUnique({
      where: { id: req.params.id },
      select: { id: true, status: true },
    });
    if (!ticket) { sendNotFound(res, 'Ticket'); return; }

    const statusChanged = data.statusTo && data.statusTo !== ticket.status;

    const update = await prisma.$transaction(async (tx) => {
      const created = await tx.ticketUpdate.create({
        data: {
          ticketId: req.params.id,
          authorUserId: authReq.user.id,
          body: data.body,
          statusFrom: ticket.status as never,
          statusTo: (data.statusTo as never) ?? undefined,
        },
      });

      if (statusChanged) {
        await tx.maintenanceTicket.update({
          where: { id: req.params.id },
          data: {
            status: data.statusTo,
            resolvedAt: data.statusTo === 'RESOLVED' ? new Date() : undefined,
          },
        });
      }

      return created;
    });

    await logAdminAction('ADD_TICKET_UPDATE', 'maintenanceTicket', req.params.id, {
      statusTo: data.statusTo ?? null,
    }, authReq);

    sendCreated(res, update, 'Update added successfully');
  })
);

// ── POST /:id/photos — attach a photo ────────────────────────────────────────

router.post(
  '/:id/photos',
  authenticateToken,
  requirePropertyManager,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const data = ticketPhotoSchema.parse(req.body);

    const ticket = await prisma.maintenanceTicket.findUnique({
      where: { id: req.params.id },
      select: { id: true },
    });
    if (!ticket) { sendNotFound(res, 'Ticket'); return; }

    await prisma.ticketPhoto.create({
      data: {
        ticketId: req.params.id,
        fileKey: data.fileKey,
        caption: data.caption ?? undefined,
        uploadedBy: authReq.user.id,
      },
    });

    await logAdminAction('ADD_TICKET_PHOTO', 'maintenanceTicket', req.params.id, {
      fileKey: data.fileKey,
    }, authReq);

    const photos = await prisma.ticketPhoto.findMany({
      where: { ticketId: req.params.id },
      orderBy: { createdAt: 'asc' },
    });

    sendCreated(res, photos, 'Photo added successfully');
  })
);

// ── DELETE /:id — hard delete ticket (admin) ──────────────────────────────────

router.delete(
  '/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;

    const ticket = await prisma.maintenanceTicket.findUnique({
      where: { id: req.params.id },
      select: { id: true, title: true, buildingId: true },
    });
    if (!ticket) { sendNotFound(res, 'Ticket'); return; }

    await prisma.maintenanceTicket.delete({ where: { id: req.params.id } });

    await logAdminAction('DELETE_TICKET', 'maintenanceTicket', req.params.id, {
      title: ticket.title,
      buildingId: ticket.buildingId,
    }, authReq);

    sendSuccess(res, null, 'Ticket deleted successfully');
  })
);

export default router;
