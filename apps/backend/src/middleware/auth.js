import jwt from 'jsonwebtoken';
import { prisma } from '@propgroup/db';

// Middleware to prevent caching of user-specific data
export const noCache = (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
};

export const authenticateToken = async (req, res, next) => {
  try {
    // Add no-cache headers to all authenticated requests
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'No authentication token provided'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from database to ensure they still exist and are active
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
        createdAt: true,
        updatedAt: true
      }
    });

    if (!user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not found'
      });
    }

    if (!user.isActive || user.bannedAt) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Account is inactive or banned'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid token'
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Token expired'
      });
    }

    console.error('Auth middleware error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Authentication failed'
    });
  }
};

export const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'Authentication required' 
    });
  }

  if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ 
      error: 'Forbidden', 
      message: 'Admin access required' 
    });
  }

  next();
};

export const requireSuperAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'Authentication required' 
    });
  }

  if (req.user.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ 
      error: 'Forbidden', 
      message: 'Super admin access required' 
    });
  }

  next();
};

export const logAdminAction = async (action, targetType, targetId, details, req) => {
  try {
    if (!req.user || (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN')) {
      return;
    }

    await prisma.adminAuditLog.create({
      data: {
        adminId: req.user.id,
        action,
        targetType,
        targetId,
        details,
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent')
      }
    });
  } catch (error) {
    console.error('Error logging admin action:', error);
  }
};
