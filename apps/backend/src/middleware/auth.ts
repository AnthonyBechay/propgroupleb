import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '@propgroup/db';
import type { AuthenticatedRequest, AuthUser } from '../types/index.js';
import { logger } from '../utils/logger.js';

// Middleware to prevent caching of user-specific data
export function noCache(_req: Request, res: Response, next: NextFunction) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
}

// Main authentication middleware - verifies JWT and loads user
export async function authenticateToken(req: Request, res: Response, next: NextFunction) {
  try {
    // Add no-cache headers to authenticated requests
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'No authentication token provided',
      });
      return;
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET is not configured');
    }

    const decoded = jwt.verify(token, secret) as { userId: string };

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        bannedAt: true,
        emailVerifiedAt: true,
        firstName: true,
        lastName: true,
        phone: true,
        country: true,
        investmentGoals: true,
        membershipTier: true,
        membershipStartDate: true,
        membershipEndDate: true,
        agentCommissionRate: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'User not found',
      });
      return;
    }

    if (!user.isActive || user.bannedAt) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Account is inactive or banned',
      });
      return;
    }

    (req as AuthenticatedRequest).user = user as AuthUser;
    next();
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'JsonWebTokenError') {
        res.status(401).json({ error: 'Unauthorized', message: 'Invalid token' });
        return;
      }
      if (error.name === 'TokenExpiredError') {
        res.status(401).json({ error: 'Unauthorized', message: 'Token expired' });
        return;
      }
    }

    logger.error('Auth middleware error', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Authentication failed',
    });
  }
}

/**
 * Generic role-based authorization middleware.
 * Usage: requireRole('ADMIN', 'SUPER_ADMIN')
 */
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as AuthenticatedRequest).user;

    if (!user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    if (!roles.includes(user.role)) {
      res.status(403).json({
        error: 'Forbidden',
        message: `Access requires one of: ${roles.join(', ')}`,
      });
      return;
    }

    next();
  };
}

/**
 * Optional authentication middleware.
 * Decodes the JWT if present and attaches req.user, but never rejects the
 * request. Use on public routes that behave differently for authenticated users
 * (e.g. admin sees all units; public sees only available ones).
 */
export async function optionalAuthenticateToken(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    try {
      const secret = process.env.JWT_SECRET;
      if (secret) {
        const decoded = jwt.verify(token, secret) as { userId: string };
        const user = await prisma.user.findUnique({
          where: { id: decoded.userId },
          select: {
            id: true, email: true, role: true,
            isActive: true, bannedAt: true,
            firstName: true, lastName: true,
            phone: true, country: true,
            investmentGoals: true, membershipTier: true,
            membershipStartDate: true, membershipEndDate: true,
            agentCommissionRate: true, createdAt: true, updatedAt: true,
          },
        });
        if (user && user.isActive && !user.bannedAt) {
          (req as AuthenticatedRequest).user = user as AuthUser;
        }
      }
    } catch {
      // Expired / invalid token — continue as unauthenticated
    }
  }
  next();
}

// Convenience aliases
export const requireAdmin = requireRole('ADMIN', 'SUPER_ADMIN');
export const requireSuperAdmin = requireRole('SUPER_ADMIN');
export const requireAgent = requireRole('AGENT', 'ADMIN', 'SUPER_ADMIN');
export const requirePropertyManager = requireRole('PROPERTY_MANAGER', 'ADMIN', 'SUPER_ADMIN');

/**
 * Log an admin action to the audit log.
 */
export async function logAdminAction(
  action: string,
  targetType: string,
  targetId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  details: Record<string, any>,
  req: Request
) {
  try {
    const user = (req as AuthenticatedRequest).user;
    const privileged = ['ADMIN', 'SUPER_ADMIN', 'PROPERTY_MANAGER'];
    if (!user || !privileged.includes(user.role)) {
      return;
    }

    await prisma.adminAuditLog.create({
      data: {
        adminId: user.id,
        action,
        targetType,
        targetId,
        details,
        ipAddress: req.ip || undefined,
        userAgent: req.get('User-Agent'),
      },
    });
  } catch (error) {
    logger.error('Error logging admin action', error);
  }
}
