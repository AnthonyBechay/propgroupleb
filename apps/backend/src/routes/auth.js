import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '@propgroup/db';
import { authenticateToken, logAdminAction } from '../middleware/auth.js';
import passport from '../config/passport.js';

const router = express.Router();

// Validation schemas
const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  country: z.string().optional(),
  investmentGoals: z.array(z.enum(['HIGH_ROI', 'CAPITAL_GROWTH', 'GOLDEN_VISA'])).optional()
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required')
});

// Helper function to create JWT token
const createToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// Helper function to set secure cookie
const setTokenCookie = (res, token) => {
  const isProduction = process.env.NODE_ENV === 'production';
  const cookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax', // 'none' for cross-origin in production
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/',
    domain: isProduction ? undefined : undefined // Let browser handle domain
  };
  
  res.cookie('token', token, cookieOptions);
  
  // Also set in response header for debugging
  if (isProduction) {
    res.setHeader('Set-Cookie', `token=${token}; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=${7 * 24 * 60 * 60}`);
  }
};

// Register new user
router.post('/register', async (req, res) => {
  try {
    const validatedData = registerSchema.parse(req.body);
    
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email }
    });

    if (existingUser) {
      return res.status(400).json({
        error: 'User already exists',
        message: 'An account with this email already exists'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(validatedData.password, 12);

    // Create user
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
        isActive: true
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
        membershipStartDate: true,
        membershipEndDate: true,
        isActive: true,
        emailVerifiedAt: true,
        createdAt: true
      }
    });

    // Create token
    const token = createToken(user.id);
    setTokenCookie(res, token);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: user
    });

  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid input data',
        details: error.errors
      });
    }

    console.error('Registration error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to register user'
    });
  }
});

// Login user
router.post('/login', async (req, res, next) => {
  try {
    // Handle OPTIONS preflight explicitly
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }

    const validatedData = loginSchema.parse(req.body);

    passport.authenticate('local', (err, user, info) => {
      if (err) {
        console.error('Login error:', err);
        return res.status(500).json({
          error: 'Internal Server Error',
          message: 'Failed to login'
        });
      }

      if (!user) {
        return res.status(401).json({
          error: 'Invalid credentials',
          message: info?.message || 'Email or password is incorrect'
        });
      }

      // Create token
      const token = createToken(user.id);
      setTokenCookie(res, token);

      // Return user data (excluding password)
      const { password, ...userWithoutPassword } = user;

      res.json({
        success: true,
        message: 'Login successful',
        data: userWithoutPassword
      });
    })(req, res, next);

  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid input data',
        details: error.errors
      });
    }

    console.error('Login error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to login'
    });
  }
});

// Get current user - Optional auth, returns null if not authenticated
router.get('/me', async (req, res) => {
  try {
    // Try to authenticate, but don't fail if no token
    const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.json({
        success: true,
        data: null
      });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
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

      if (!user || !user.isActive || user.bannedAt) {
        return res.json({
          success: true,
          data: null
        });
      }

      res.json({
        success: true,
        data: user
      });
    } catch (tokenError) {
      // Token is invalid or expired, return null
      return res.json({
        success: true,
        data: null
      });
    }
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get user data'
    });
  }
});

// Logout user
router.post('/logout', (req, res) => {
  // Clear cookie with same options as when it was set
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  });
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

// Update user profile
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const updateSchema = z.object({
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      phone: z.string().optional(),
      country: z.string().optional(),
      investmentGoals: z.array(z.enum(['HIGH_ROI', 'CAPITAL_GROWTH', 'GOLDEN_VISA'])).optional()
    });

    const validatedData = updateSchema.parse(req.body);

    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: validatedData,
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
        membershipStartDate: true,
        membershipEndDate: true,
        isActive: true,
        emailVerifiedAt: true,
        createdAt: true,
        updatedAt: true
      }
    });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: updatedUser
    });

  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid input data',
        details: error.errors
      });
    }

    console.error('Update profile error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update profile'
    });
  }
});

// Change password
router.put('/change-password', authenticateToken, async (req, res) => {
  try {
    const changePasswordSchema = z.object({
      currentPassword: z.string().min(1, 'Current password is required'),
      newPassword: z.string().min(8, 'New password must be at least 8 characters')
    });

    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);

    // Get user with password
    const user = await prisma.user.findUnique({
      where: { id: req.user.id }
    });

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);

    if (!isValidPassword) {
      return res.status(400).json({
        error: 'Invalid password',
        message: 'Current password is incorrect'
      });
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 12);

    // Update password
    await prisma.user.update({
      where: { id: req.user.id },
      data: { password: hashedNewPassword }
    });

    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid input data',
        details: error.errors
      });
    }

    console.error('Change password error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to change password'
    });
  }
});

// Google OAuth Routes (only if configured)
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  // Initiate Google OAuth
  router.get('/google',
    passport.authenticate('google', {
      scope: ['profile', 'email']
    })
  );

  // Google OAuth callback
  router.get('/google/callback',
    passport.authenticate('google', {
      failureRedirect: `${process.env.FRONTEND_URL}/login?error=oauth_failed`,
      session: false
    }),
    (req, res) => {
      try {
        // Create JWT token
        const token = createToken(req.user.id);
        setTokenCookie(res, token);

        // Redirect to frontend with success
        res.redirect(`${process.env.FRONTEND_URL}/auth/callback?success=true`);
      } catch (error) {
        console.error('Google callback error:', error);
        res.redirect(`${process.env.FRONTEND_URL}/login?error=callback_failed`);
      }
    }
  );
} else {
  // Return 404 for Google OAuth routes if not configured
  router.get('/google', (req, res) => {
    res.status(404).json({
      error: 'Not configured',
      message: 'Google OAuth is not configured on this server'
    });
  });

  router.get('/google/callback', (req, res) => {
    res.status(404).json({
      error: 'Not configured',
      message: 'Google OAuth is not configured on this server'
    });
  });
}

export default router;
