import crypto from 'node:crypto';
import type { Request } from 'express';

/**
 * Is this request our own other storefront, forwarding on a visitor's behalf?
 *
 * propgrp.com posts its leads from its server, not from the visitor's browser,
 * so every per-IP limit here sees one address for the whole site. It proves
 * who it is with a shared secret (`STOREFRONT_FORWARD_SECRET`, the same value
 * in both apps). Unset on either side, nothing is trusted and the limits apply
 * exactly as before.
 */
export function trustedStorefront(req: Request): boolean {
  const secret = process.env.STOREFRONT_FORWARD_SECRET;
  const given = req.get('x-storefront-secret');
  if (!secret || !given) return false;
  const a = Buffer.from(secret);
  const b = Buffer.from(given);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
