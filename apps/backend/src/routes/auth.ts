import express, { type Request, type Response, type NextFunction, type Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '@propgroup/db';
import { authenticateToken, logAdminAction } from '../middleware/auth.js';
import { asyncHandler } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { sendSuccess, sendCreated } from '../utils/response.js';
import { USER_AUTH_SELECT } from '../utils/prisma-includes.js';
import { registerSchema, loginSchema, updateProfileSchema, changePasswordSchema } from '../schemas/index.js';
import crypto from 'node:crypto';
import { sendWelcomeEmail, sendPasswordResetEmail } from '../services/email.service.js';
import passport from '../config/passport.js';
import type { AuthenticatedRequest } from '../types/index.js';

const router: Router = express.Router();

// No-cache headers for all auth routes
router.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// Helper: create JWT token
function createToken(userId: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not configured');
  const options: jwt.SignOptions = {};
  (options as Record<string, unknown>).expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  return jwt.sign({ userId }, secret, options);
}

// Helper: set secure cookie
function setTokenCookie(res: Response, token: string) {
  const isProduction = process.env.NODE_ENV === 'production';
  res.cookie('token', token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/',
  });
}

// Register
router.post(
  '/register',
  asyncHandler(async (req: Request, res: Response) => {
    const validatedData = registerSchema.parse(req.body);
    validatedData.email = validatedData.email.toLowerCase().trim();

    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email },
    });

    if (existingUser) {
      res.status(400).json({
        error: 'User already exists',
        message: 'An account with this email already exists',
      });
      return;
    }

    const hashedPassword = await bcrypt.hash(validatedData.password, 12);

    const user = await prisma.user.create({
      data: {
        email: validatedData.email,
        password: hashedPassword,
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
        phone: validatedData.phone,
        country: validatedData.country,
        investmentGoals: validatedData.investmentGoals || [],
        provider: 'local',
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        country: true,
        role: true,
        investmentGoals: true,
        membershipTier: true,
        isActive: true,
        createdAt: true,
      },
    });

    const token = createToken(user.id);
    setTokenCookie(res, token);

    // Send welcome email (fire and forget)
    sendWelcomeEmail(user.email, user.firstName || undefined).catch(err =>
      logger.error('Failed to send welcome email', err)
    );

    sendCreated(res, user, 'User registered successfully');
  })
);

// Login
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validatedData = loginSchema.parse(req.body);
    validatedData.email = validatedData.email.toLowerCase().trim();

    passport.authenticate('local', (err: Error | null, user: Record<string, unknown> | false, info?: { message: string }) => {
      if (err) {
        res.status(500).json({ error: 'Internal Server Error', message: 'Failed to login' });
        return;
      }

      if (!user) {
        res.status(401).json({
          error: 'Invalid credentials',
          message: info?.message || 'Email or password is incorrect',
        });
        return;
      }

      const token = createToken(user.id as string);
      setTokenCookie(res, token);

      const { password: _pw, ...userWithoutPassword } = user;

      res.json({
        success: true,
        message: 'Login successful',
        data: userWithoutPassword,
      });
    })(req, res, next);
  } catch (error) {
    next(error);
  }
});

// Get current user (optional auth)
router.get(
  '/me',
  asyncHandler(async (req: Request, res: Response) => {
    const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      sendSuccess(res, null);
      return;
    }

    try {
      const secret = process.env.JWT_SECRET;
      if (!secret) throw new Error('JWT_SECRET not configured');
      const decoded = jwt.verify(token, secret) as { userId: string };

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: USER_AUTH_SELECT,
      });

      if (!user || !user.isActive || user.bannedAt) {
        sendSuccess(res, null);
        return;
      }

      sendSuccess(res, user);
    } catch {
      // Token invalid or expired
      sendSuccess(res, null);
    }
  })
);

// Logout — stateless JWT, just clear the cookie.
router.post('/logout', (_req: Request, res: Response) => {
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: (process.env.NODE_ENV === 'production' ? 'none' : 'lax') as 'none' | 'lax',
    path: '/',
  };

  res.clearCookie('token', cookieOptions);
  res.clearCookie('connect.sid', cookieOptions);

  res.json({
    success: true,
    message: 'Logged out successfully',
  });
});

// Update profile
router.put(
  '/profile',
  authenticateToken,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const validatedData = updateProfileSchema.parse(req.body);

    const updatedUser = await prisma.user.update({
      where: { id: authReq.user.id },
      data: validatedData,
      select: USER_AUTH_SELECT,
    });

    sendSuccess(res, updatedUser, 'Profile updated successfully');
  })
);

// Change password
router.put(
  '/change-password',
  authenticateToken,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { id: authReq.user.id },
    });

    if (!user?.password) {
      res.status(400).json({
        error: 'Error',
        message: 'Cannot change password for OAuth accounts',
      });
      return;
    }

    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      res.status(400).json({
        error: 'Invalid password',
        message: 'Current password is incorrect',
      });
      return;
    }

    const hashedNew = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: authReq.user.id },
      data: { password: hashedNew },
    });

    sendSuccess(res, null, 'Password changed successfully');
  })
);

// Forgot password
router.post(
  '/forgot-password',
  asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ error: 'Email is required' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });

    // Always respond success to prevent email enumeration
    if (!user || !user.password) {
      sendSuccess(res, null, 'If an account exists with this email, a reset link has been sent.');
      return;
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken, resetTokenExpiry },
    });

    await sendPasswordResetEmail(user.email, resetToken);

    sendSuccess(res, null, 'If an account exists with this email, a reset link has been sent.');
  })
);

// Reset password
router.post(
  '/reset-password',
  asyncHandler(async (req: Request, res: Response) => {
    const { token, password } = req.body;
    if (!token || !password) {
      res.status(400).json({ error: 'Token and password are required' });
      return;
    }

    if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      res.status(400).json({ error: 'Password must be at least 8 characters with 1 uppercase letter and 1 number' });
      return;
    }

    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: { gt: new Date() },
      },
    });

    if (!user) {
      res.status(400).json({ error: 'Invalid or expired reset token' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    sendSuccess(res, null, 'Password reset successfully. You can now log in.');
  })
);

// Google OAuth Routes (only if configured)
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  router.get(
    '/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
  );

  router.get(
    '/google/callback',
    passport.authenticate('google', {
      failureRedirect: `${process.env.FRONTEND_URL}/login?error=oauth_failed`,
      session: false,
    }),
    (req: Request, res: Response) => {
      try {
        const user = req.user as { id: string };
        const token = createToken(user.id);
        setTokenCookie(res, token);
        res.redirect(`${process.env.FRONTEND_URL}/auth/callback?success=true`);
      } catch {
        res.redirect(`${process.env.FRONTEND_URL}/login?error=callback_failed`);
      }
    }
  );
} else {
  router.get('/google', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'Not configured', message: 'Google OAuth is not configured' });
  });
  router.get('/google/callback', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'Not configured', message: 'Google OAuth is not configured' });
  });
}

export default router;
