import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import { prisma } from '@propgroup/db';
import passport from './config/passport.js';
import { errorHandler } from './utils/errors.js';
import { logger } from './utils/logger.js';

// Import routes
import authRoutes from './routes/auth.js';
import propertyRoutes from './routes/properties.js';
import userRoutes from './routes/users.js';
import favoriteRoutes from './routes/favorites.js';
import inquiryRoutes from './routes/inquiries.js';
import portfolioRoutes from './routes/portfolio.js';
import adminRoutes from './routes/admin.js';
import agentRoutes from './routes/agent.js';
import aiSearchRoutes from './routes/ai-search.js';
import contentRoutes from './routes/content.js';
import contactRoutes from './routes/contact.js';
import uploadRoutes from './routes/upload.js';
import shareRoutes from './routes/share.js';
import documentRoutes from './routes/documents.js';
import fileRoutes from './routes/files.js';
import locationGuideRoutes from './routes/location-guides.js';

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
      skip: (req) => req.url === '/health' || req.url === '/api/health',
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
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
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

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/users', userRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/inquiries', inquiryRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/ai-search', aiSearchRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/location-guides', locationGuideRoutes);
app.use('/api/share', shareRoutes);

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
