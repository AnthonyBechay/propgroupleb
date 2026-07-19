import express from 'express';
import compression from 'compression';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import { prisma } from '@propgroup/db';
import passport from './config/passport.js';
import { errorHandler } from './utils/errors.js';
import { logger } from './utils/logger.js';
import { validateEnv } from './utils/validate-env.js';

// Import routes
import authRoutes from './routes/auth.js';
import propertyRoutes from './routes/properties.js';
import buildingRoutes from './routes/buildings.js';
import unitRoutes from './routes/units.js';
import listingRoutes from './routes/listings.js';
import tenancyRoutes from './routes/tenancies.js';
import ticketRoutes from './routes/tickets.js';
import vendorRoutes from './routes/vendors.js';
import utilityRoutes from './routes/utilities.js';
import serviceChargeRoutes from './routes/service-charges.js';
import managementRoutes from './routes/management.js';
import fxRateRoutes from './routes/fx-rates.js';
import userRoutes from './routes/users.js';
import favoriteRoutes from './routes/favorites.js';
import inquiryRoutes from './routes/inquiries.js';
import portfolioRoutes from './routes/portfolio.js';
import adminRoutes from './routes/admin.js';
import agentRoutes from './routes/agent.js';
import aiSearchRoutes from './routes/ai-search.js';
import aiSeoRoutes from './routes/ai-seo.js';
import analyticsRoutes from './routes/analytics.js';
import settingsRoutes from './routes/settings.js';
import organizationsRoutes from './routes/organizations.js';
import contentRoutes from './routes/content.js';
import contactRoutes from './routes/contact.js';
import uploadRoutes from './routes/upload.js';
import shareRoutes from './routes/share.js';
import documentRoutes from './routes/documents.js';
import fileRoutes from './routes/files.js';
import locationGuideRoutes from './routes/location-guides.js';
import submissionRoutes from './routes/submissions.js';

const app = express();
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Trust proxy for reverse proxy deployments (Coolify/nginx)
app.set('trust proxy', 1);

// Security middleware
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    // Cloudflare handles HSTS at the edge. Helmet v7 enables HSTS by default,
    // which combined with Cloudflare's alt-svc header causes Chrome to lock
    // into QUIC aggressively and fail intermittently.
    strictTransportSecurity: false,
  })
);

// Gzip/brotli-equivalent compression — property lists and admin payloads are
// JSON-heavy and compress 3-5×. Placed before routes so every response passes
// through. `threshold: 1024` skips tiny bodies where framing overhead > win.
app.use(
  compression({
    threshold: 1024,
    // Allow clients to opt out via `x-no-compression` header (useful for
    // debugging raw bytes with curl).
    filter: (req, res) =>
      req.headers['x-no-compression'] ? false : compression.filter(req, res),
  })
);
// Request logging — structured JSON in production, readable in dev
const isProduction = process.env.NODE_ENV === 'production';
app.use(
  morgan(
    (tokens, req, res) => {
      const method = tokens.method(req, res);
      const url = tokens.url(req, res);
      const status = tokens.status(req, res);
      const responseTime = tokens['response-time'](req, res);

      if (isProduction) {
        return JSON.stringify({
          level: Number(status) >= 500 ? 'error' : Number(status) >= 400 ? 'warn' : 'info',
          message: 'request',
          timestamp: new Date().toISOString(),
          method,
          path: url,
          status: Number(status),
          responseTime: `${responseTime}ms`,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        });
      }

      const icon = Number(status) >= 500 ? 'ERR' : Number(status) >= 400 ? 'WARN' : 'OK';
      return `[${icon}] ${method} ${url} ${status} ${responseTime}ms`;
    },
    {
      // In production, log only what's worth reading: errors, slow requests,
      // mutations, and uncommon GETs. Drops the routine high-volume noise that
      // otherwise drowns the signal — health checks, OPTIONS preflights,
      // image proxy hits, and the auth/me poll fired by every admin page.
      skip: (req, res) => {
        if (req.url === '/health' || req.url === '/api/health') return true;
        if (!isProduction) return false;

        const status = res.statusCode;
        // Always keep anything that smells like a problem
        if (status >= 400) return false;
        // Drop OPTIONS preflights (handled by cors, always 204, never useful)
        if (req.method === 'OPTIONS') return true;
        // Always keep mutations
        if (req.method !== 'GET' && req.method !== 'HEAD') return false;
        // Drop the file proxy — this is the #1 source of log volume during
        // admin work and marketing page renders. R2 outcomes are observable
        // from R2 itself; here we only care if it 4xx/5xxs (kept above).
        if (req.url.startsWith('/api/files/')) return true;
        // Drop the session-poll endpoint hit on every admin page mount
        if (req.url.startsWith('/api/auth/me')) return true;
        return false;
      },
    }
  )
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// CORS configuration - use ALLOWED_ORIGINS env var, fallback to FRONTEND_URL
const allowedOrigins = (process.env.ALLOWED_ORIGINS || FRONTEND_URL)
  .split(',')
  .map((url) => url.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow origin-less requests (server-to-server, health checks,
      // Cloudflare probes, curl, etc.)
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else if (process.env.NODE_ENV !== 'production') {
        // In development, allow localhost variants
        if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
          callback(null, true);
        } else {
          callback(null, false);
        }
      } else {
        callback(null, false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'X-Requested-With', 'Accept', 'Origin'],
    exposedHeaders: ['Set-Cookie'],
    maxAge: 86400,
  })
);

// Rate limiting
// `max` is per-IP per-window. 200 was tight enough that a single visitor
// browsing ~5 properties with the CDN bypassed (image proxy + RSC chunks all
// counting against quota) could trip it, and CGNAT/corporate NAT users share
// IPs which compounds it. 1000/15min comfortably accommodates 100 concurrent
// real users while still rejecting obvious abuse.
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // Stricter for auth endpoints
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', generalLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Initialize Passport (JWT-only, no sessions)
app.use(passport.initialize());

// Health check endpoint
app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      database: 'connected',
      uptime: process.uptime(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Health check failed', error);
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      database: 'disconnected',
      error: message,
    });
  }
});

// Also support /health for Docker health checks
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// API routes — core
app.use('/api/auth', authRoutes);
app.use('/api/buildings', buildingRoutes);
app.use('/api/units', unitRoutes);
app.use('/api/listings', listingRoutes);
app.use('/api/users', userRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/inquiries', inquiryRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/ai-search', aiSearchRoutes);
app.use('/api/ai-seo', aiSeoRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/organizations', organizationsRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/location-guides', locationGuideRoutes);
app.use('/api/share', shareRoutes);
app.use('/api/submissions', submissionRoutes);

// API routes — property management
app.use('/api/tenancies', tenancyRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/utilities', utilityRoutes);
app.use('/api/service-charges', serviceChargeRoutes);
app.use('/api/management', managementRoutes);
app.use('/api/fx-rates', fxRateRoutes);

// Legacy alias — keep /api/properties working during transition
app.use('/api/properties', propertyRoutes);

// Global error handler
app.use(errorHandler);

// 404 handler
app.use('*', (_req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${_req.originalUrl} not found`,
  });
});

// Graceful shutdown
async function shutdown() {
  logger.info('Shutting down gracefully');
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Unhandled rejection / exception logging
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception — shutting down', error);
  process.exit(1);
});

// Startup
async function startServer() {
  try {
    // Validate env before touching DB so missing config surfaces first
    validateEnv();
    await prisma.$queryRaw`SELECT 1`;
    logger.info('Database connected');

    const server = app.listen(PORT, () => {
      logger.info('Server started', {
        port: PORT,
        env: process.env.NODE_ENV || 'development',
        cors: allowedOrigins,
      });
    });

    // Keep-alive must exceed Cloudflare's timeout (100s) to prevent
    // intermittent 520 / ERR_CONNECTION_TIMED_OUT errors.
    server.keepAliveTimeout = 120_000;
    server.headersTimeout = 125_000;
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

startServer();
