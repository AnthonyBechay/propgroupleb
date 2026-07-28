import type { Response } from 'express';
import jwt from 'jsonwebtoken';

/**
 * Single source of truth for how long a login lasts and how the cookie is set.
 *
 * Sessions are 14 days AND sliding: every authenticated request re-issues the
 * cookie when it's past the halfway mark, so somebody using the admin daily is
 * never logged out. Only a genuinely idle fortnight ends the session.
 */
export const SESSION_DAYS = Number(process.env.SESSION_DAYS || 14);
export const SESSION_MS = SESSION_DAYS * 24 * 60 * 60 * 1000;

/** Re-issue the cookie once the token is more than halfway to expiry. */
const RENEW_AFTER_MS = SESSION_MS / 2;

export function createToken(userId: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not configured');
  const options: jwt.SignOptions = {};
  (options as Record<string, unknown>).expiresIn = process.env.JWT_EXPIRES_IN || `${SESSION_DAYS}d`;
  return jwt.sign({ userId }, secret, options);
}

export function setTokenCookie(res: Response, token: string): void {
  const isProduction = process.env.NODE_ENV === 'production';
  res.cookie('token', token, {
    httpOnly: true,
    secure: isProduction,
    // Cross-site (api.* → www.*) needs SameSite=None, which requires Secure.
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: SESSION_MS,
    path: '/',
  });
}

export function clearTokenCookie(res: Response): void {
  const isProduction = process.env.NODE_ENV === 'production';
  res.clearCookie('token', {
    httpOnly: true,
    secure: isProduction,
    sameSite: (isProduction ? 'none' : 'lax') as 'none' | 'lax',
    path: '/',
  });
}

/**
 * Slide the session forward when the token is past halfway. Cheap (one sign +
 * one Set-Cookie) and only fires occasionally, so it costs nothing per request.
 */
export function maybeRenewSession(res: Response, decoded: { userId: string; exp?: number }): void {
  if (!decoded.exp) return;
  const expiresAt = decoded.exp * 1000;
  const remaining = expiresAt - Date.now();
  if (remaining > 0 && remaining < SESSION_MS - RENEW_AFTER_MS) {
    try {
      setTokenCookie(res, createToken(decoded.userId));
    } catch {
      // Never fail a request because renewal didn't work.
    }
  }
}
