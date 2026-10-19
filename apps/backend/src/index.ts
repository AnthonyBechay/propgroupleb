import express from 'express';
import compression from 'compression';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import { prisma } from '@propgroup/db';
import passport from './config/passport.js';
import { checkAiAccess, isAiEnabled } from './config/ai.js';
import { errorHandler } from './utils/errors.js';
import { logger } from './utils/logger.js';
import { validateEnv } from './utils/validate-env.js';
import { ensureReferenceCodes } from './utils/reference.js';
import { normaliseCrmData } from './utils/crm-bootstrap.js';
import { startInstagramTokenRefresh } from './services/instagram-token.service.js';
import { startQuietSweep } from './services/auto-reply.service.js';
import { startFollowUpSweep } from './services/follow-up.service.js';

// Import routes
import authRoutes from './routes/auth.js';
import propertyRoutes from './routes/properties.js';
import buildingRoutes from './routes/buildings.js';
import unitRoutes from './routes/units.js';
import listingRoutes from './routes/listings.js';
import fxRateRoutes from './routes/fx-rates.js';
import userRoutes from './routes/users.js';
import favoriteRoutes from './routes/favorites.js';
import inquiryRoutes from './routes/inquiries.js';
import portfolioRoutes from './routes/portfolio.js';
import adminRoutes from './routes/admin.js';
import agentRoutes from './routes/agent.js';
import aiSeoRoutes from './routes/ai-seo.js';
import analyticsRoutes from './routes/analytics.js';
import contentRoutes from './routes/content.js';
import contactRoutes from './routes/contact.js';
import uploadRoutes from './routes/upload.js';
import shareRoutes from './routes/share.js';
import documentRoutes from './routes/documents.js';
import fileRoutes from './routes/files.js';
import locationGuideRoutes from './routes/location-guides.js';
import submissionRoutes from './routes/submissions.js';
import crmRoutes from './routes/crm.js';
import inboxRoutes from './routes/inbox.js';
import adsRoutes from './routes/ads.js';
import aiUsageRoutes from './routes/ai-usage.js';
import aiSettingsRoutes from './routes/ai-settings.js';
import pipelineRoutes from './routes/pipeline.js';
import webhookRoutes from './routes/webhooks.js';
import { privateFieldGuard } from './middleware/auth.js';

const app = express();
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Trust proxy for reverse proxy deployments (Coolify/nginx)
app.set('trust proxy', 1);

// Flat query strings only. The default parser turns `?status[not]=x` into an
// object, and an object dropped into a Prisma `where` is a filter the caller
// wrote — the same class of bug as the reset-token bypass, on every list route.
app.set('query parser', 'simple');

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
// Request logging. The log is for things that happened, so a request only
// earns a line when it tells you something:
//   - anything that failed (4xx / 5xx)
//   - anything that changed data (POST / PUT / PATCH / DELETE)
//   - anything slow
// A successful read says nothing — and the CRM's screens poll every few
// seconds, which used to bury everything else under identical GET lines.
// Webhook deliveries are left to the handlers, which log what the message WAS
// rather than that a POST arrived.
const SLOW_MS = 2000;
app.use(
  morgan(
    (tokens, req, res) => {
      const status = Number(tokens.status(req, res));
      const ms = Math.round(Number(tokens['response-time'](req, res)) || 0);
      const line = `${tokens.method(req, res)} ${tokens.url(req, res)}`;
      const meta = { status, ms, ...(status >= 400 ? { ip: req.ip } : {}) };
      if (status >= 500) logger.error(line, undefined, meta);
      else if (status >= 400 || ms >= SLOW_MS) logger.warn(ms >= SLOW_MS && status < 400 ? `${line} (slow)` : line, meta);
      else logger.info(line, meta);
      // The logger has written the line; morgan itself prints nothing.
      return null;
    },
    {
      skip: (req, res) => {
        // originalUrl, not url: by the time the response finishes, a mounted
        // router has stripped its prefix from req.url ("/ycloud", not
        // "/api/webhooks/ycloud"), which is how every webhook delivery and read
        // receipt still got a line of its own.
        const url = req.originalUrl ?? req.url;
        if (url === '/health' || url === '/api/health') return true;
        if (res.statusCode >= 400) return false;
        if (req.method === 'OPTIONS') return true;
        if (url.startsWith('/api/webhooks/')) return true;
        // Marking a thread read is the inbox poll's shadow, not a real change.
        if (/^\/api\/crm\/inbox\/[^/]+\/read/.test(url)) return true;
        // Page-view beacons: one per visitor click, and the analytics screen counts them anyway.
        if (url.startsWith('/api/analytics/track')) return true;
        if (req.method === 'GET' || req.method === 'HEAD') {
          // Keep only the slow ones; response time is not known here, so let
          // the formatter decide by returning false for nothing else.
          const started = (req as express.Request & { _startAt?: [number, number] })._startAt;
          if (!started) return true;
          const [s, ns] = process.hrtime(started);
          return s * 1000 + ns / 1e6 < SLOW_MS;
        }
        return false;
      },
    }
  )
);
app.use(
  express.json({
    limit: '10mb',
    // Meta webhook signatures cover the exact bytes sent, which JSON.parse
    // throws away — stash them for the signature check.
    verify: (req, _res, buf) => {
      if (req.url?.startsWith('/api/webhooks/')) {
        (req as express.Request & { rawBody?: Buffer }).rawBody = Buffer.from(buf);
      }
    },
  })
);
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

// ── CSRF: same-origin guard on state-changing requests ───────────────────────
// The auth cookie is `SameSite=None` in production, because the API and the two
// public sites live on different hosts — so the browser attaches it to
// cross-site requests as well. CORS does not close that: a plain <form> POST is
// a "simple request", it is sent with no preflight, and an attacker never needs
// to read the response to have already caused the write. Browsers do always
// send `Origin` on those, so rejecting an unrecognised one is enough.
//
// A request with no Origin at all is left alone: that is server-to-server
// traffic (propgrp.com's SSR, health checks, curl), which cannot be a browser
// forging a logged-in user's cookie.
app.use((req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    next();
    return;
  }

  const origin = req.headers.origin;
  if (!origin || allowedOrigins.includes(origin)) {
    next();
    return;
  }

  if (
    process.env.NODE_ENV !== 'production' &&
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
  ) {
    next();
    return;
  }

  logger.warn('Rejected cross-origin write', { origin, method: req.method, path: req.originalUrl });
  res.status(403).json({
    error: 'Forbidden',
    message: 'Cross-origin request rejected',
  });
});

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

// Anything that sends mail or burns model credits on behalf of an anonymous
// caller gets its own bucket. The general limiter is sized for a person
// browsing properties; it is far too generous for an endpoint that costs money
// or lands in someone's inbox.
const expensiveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Meta delivers every WhatsApp message and ad submission from a shared pool of
 * IPs, so a busy campaign looks like one very chatty client. Tripping the
 * general limit would make Meta retry, then disable the subscription — and
 * these requests are already gated by an HMAC signature, which is a stronger
 * check than counting requests per IP.
 */
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/webhooks/', webhookLimiter);
app.use('/api/', (req, res, next) =>
  req.path.startsWith('/webhooks/') ? next() : generalLimiter(req, res, next)
);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
// Password reset was the one unmetered path into the mail provider: 1000
// requests/15min per IP is an email-bombing budget, not a rate limit.
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/reset-password', authLimiter);
// The expensive bucket existed but was never applied to anything. These two are
// what it was written for: /api/ai-seo spends model credits per call and
// /api/contact puts mail in someone's inbox.
app.use('/api/ai-seo', expensiveLimiter);
app.use('/api/contact', expensiveLimiter);
// Public AI search calls Anthropic per request — unmetered, that is somebody
// else's bill.

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
app.use('/api/buildings', privateFieldGuard, buildingRoutes);
app.use('/api/units', privateFieldGuard, unitRoutes);
app.use('/api/listings', privateFieldGuard, listingRoutes);
app.use('/api/users', userRoutes);
app.use('/api/favorites', privateFieldGuard, favoriteRoutes);
app.use('/api/inquiries', inquiryRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/agent', agentRoutes);
// AI search was removed: three UNAUTHENTICATED endpoints called Claude on every
// request, rate-limited only by the 1000-req/15-min general limiter. With a
// leaked key that cost ~$100 in 24h. Answer explicitly rather than 404 so any
// stale client is unambiguous in the logs — and costs nothing.
app.all('/api/ai-search', (_req, res) => {
  res.status(410).json({ error: 'AI search has been removed.' });
});
app.all('/api/ai-search/*', (_req, res) => {
  res.status(410).json({ error: 'AI search has been removed.' });
});

app.use('/api/ai-seo', aiSeoRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/location-guides', locationGuideRoutes);
app.use('/api/share', privateFieldGuard, shareRoutes);
app.use('/api/submissions', submissionRoutes);
// Mounted ahead of the CRM router so /api/crm/inbox/* is not read as /:id.
app.use('/api/crm/inbox', inboxRoutes);
app.use('/api/crm/ads', adsRoutes);
app.use('/api/crm/ai-usage', aiUsageRoutes);
app.use('/api/crm/ai-settings', aiSettingsRoutes);
app.use('/api/crm/pipeline', pipelineRoutes);
app.use('/api/crm', crmRoutes);
// Public by design — Meta calls it. Guarded by signature, not by auth.
app.use('/api/webhooks', webhookRoutes);

app.use('/api/fx-rates', fxRateRoutes);

// Legacy alias — keep /api/properties working during transition
app.use('/api/properties', privateFieldGuard, propertyRoutes);

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

    // Deployment uses `prisma db push`, which creates columns but never runs a
    // migration's data statements — so anything that has to *change rows* runs
    // here instead.
    //
    // Each step gets its own guard on purpose: sharing one meant a failure in
    // the first silently skipped the second, and reported the wrong thing as
    // broken. Neither blocks startup — the site works without either.
    try {
      await ensureReferenceCodes();
      logger.info('Reference codes ready');
    } catch (err) {
      logger.error('Could not initialise reference codes', { error: (err as Error).message });
    }

    try {
      await normaliseCrmData();
      logger.info('CRM data normalised');
    } catch (err) {
      logger.error('Could not normalise CRM data', { error: (err as Error).message });
    }

    // Background jobs: keep the Instagram token from expiring, and pick up
    // clients the team has left waiting.
    startInstagramTokenRefresh();
    startQuietSweep();
    startFollowUpSweep();

    const server = app.listen(PORT, () => {
      logger.info('Server started', {
        port: PORT,
        env: process.env.NODE_ENV || 'development',
        cors: allowedOrigins,
      });
    });

    // Say on every boot whether Claude is actually reachable from this
    // container. Reads model metadata only — no tokens, no cost. A generation
    // that hangs until the gateway 502s tells the browser nothing (the 502
    // carries no CORS headers, so it surfaces as a CORS error); this puts the
    // real answer in the deploy log. Fire-and-forget: it must never delay boot
    // or bring the server down.
    if (isAiEnabled()) {
      void checkAiAccess()
        .then(({ ok, detail }) =>
          ok ? logger.info(`AI ready — ${detail}`) : logger.error(`AI unavailable — ${detail}`),
        )
        .catch((err) => logger.error('AI check failed', err));
    } else {
      logger.info('AI is off (AI_ENABLED is not "true", or no ANTHROPIC_API_KEY)');
    }

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
