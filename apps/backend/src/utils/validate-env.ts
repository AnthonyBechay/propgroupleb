import { logger } from './logger.js';

/**
 * Startup env-var sanity check.
 *
 * Split into two buckets:
 *   - required: if missing in production, we throw and refuse to boot.
 *     These are things the server truly cannot function without (DB, auth).
 *   - recommended: if missing, we log a warning but boot anyway. These
 *     disable optional features (uploads, Google OAuth, email, AI) but
 *     the core read path still works.
 *
 * Called once from startServer() before the HTTP listen(). Keeps
 * misconfigurations visible in logs at boot instead of surfacing as
 * cryptic runtime errors on the first affected request.
 */

const REQUIRED = ['DATABASE_URL', 'JWT_SECRET', 'FRONTEND_URL'] as const;

const RECOMMENDED_GROUPS: Array<{ feature: string; vars: string[] }> = [
  {
    feature: 'Cloudflare R2 uploads',
    vars: ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME'],
  },
  {
    // API_URL is the preferred var — upload.service.ts uses it to build
    // the /api/files/* proxy URLs stored in the DB. NEXT_PUBLIC_API_URL
    // is accepted as a fallback but is a Next.js build-time convention
    // and may be undefined in plain Node/Express deployments.
    feature: 'File URL generation (set API_URL=https://your-backend-domain)',
    vars: ['API_URL'],
  },
  {
    feature: 'Google OAuth',
    vars: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'BACKEND_URL'],
  },
  {
    feature: 'Transactional email (Resend)',
    vars: ['RESEND_API_KEY'],
  },
  {
    feature: 'AI search (Claude)',
    vars: ['ANTHROPIC_API_KEY'],
  },
];

export function validateEnv(): void {
  const isProduction = process.env.NODE_ENV === 'production';

  // Hard requirements — always enforced in production
  const missingRequired = REQUIRED.filter((name) => !process.env[name]);
  if (missingRequired.length > 0) {
    const msg = `Missing required environment variables: ${missingRequired.join(', ')}`;
    if (isProduction) {
      // Fail fast — booting without these produces confusing 500s downstream
      throw new Error(msg);
    } else {
      logger.warn(msg);
    }
  }

  // JWT secret strength — a short/guessable secret lets an attacker forge
  // session tokens (full account takeover, including admins). 32 chars is the
  // practical floor for an HS256 signing key. Enforce in production, warn in dev.
  const jwtSecret = process.env.JWT_SECRET;
  if (jwtSecret && jwtSecret.length < 32) {
    const msg = `JWT_SECRET is weak (${jwtSecret.length} chars). Use at least 32 random characters.`;
    if (isProduction) {
      throw new Error(msg);
    } else {
      logger.warn(msg);
    }
  }

  // Soft recommendations — warn once per feature group at boot
  for (const group of RECOMMENDED_GROUPS) {
    const missing = group.vars.filter((name) => !process.env[name]);
    if (missing.length > 0) {
      logger.warn(`Feature degraded: ${group.feature} — missing ${missing.join(', ')}`);
    }
  }
}
